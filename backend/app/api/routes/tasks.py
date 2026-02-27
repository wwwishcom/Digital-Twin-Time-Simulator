from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.task import Task
from app.models.task_comment import TaskComment
from app.models.task_visibility import TaskVisibilityFriend
from app.models.user import User
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate, TaskCommentCreate, TaskCommentOut

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _sync_visibility_friends(db: Session, task_id: int, visibility: str, user_ids: list[int]):
    db.query(TaskVisibilityFriend).filter(TaskVisibilityFriend.task_id == task_id).delete()
    if visibility == "selective":
        for uid in user_ids:
            db.add(TaskVisibilityFriend(task_id=task_id, friend_user_id=uid))


def _get_canonical_task_id(task_id: int, db: Session) -> int:
    """공유 복사본이면 원본 task_id 반환 (댓글은 항상 원본에 저장)"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if task and task.shared_from_task_id:
        return task.shared_from_task_id
    return task_id


# ── CRUD ────────────────────────────────────────────────────────────────────

@router.post("", response_model=TaskOut)
def create_task(payload: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task_data = payload.model_dump(exclude={"visible_to_user_ids", "participant_ids"})
    task = Task(**task_data, user_id=current_user.id)
    db.add(task)
    db.flush()
    _sync_visibility_friends(db, task.id, payload.visibility, payload.visible_to_user_ids)

    # 참여자 복사본 생성 (함께 하기)
    for uid in payload.participant_ids:
        copy = Task(
            user_id=uid,
            title=task.title,
            category=task.category,
            expected_min=task.expected_min,
            start_at=task.start_at,
            end_at=task.end_at,
            status="planned",
            visibility="private",
            shared_from_task_id=task.id,
        )
        db.add(copy)

    db.commit()
    db.refresh(task)
    return task


@router.get("", response_model=list[TaskOut])
def list_tasks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Task).filter(Task.user_id == current_user.id).order_by(Task.start_at.asc()).all()


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    data = payload.model_dump(exclude_unset=True, exclude={"visible_to_user_ids"})
    for k, v in data.items():
        setattr(task, k, v)

    if payload.visible_to_user_ids is not None:
        _sync_visibility_friends(db, task_id, task.visibility, payload.visible_to_user_ids)

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.query(TaskVisibilityFriend).filter(TaskVisibilityFriend.task_id == task_id).delete()
    db.delete(task)
    db.commit()
    return {"deleted": True}


# ── 댓글 ────────────────────────────────────────────────────────────────────

def _can_access_task(task_id: int, user_id: int, db: Session):
    """댓글 접근 권한: 소유자 / 공유 복사본 / 공개 일정"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        return False, None
    if task.user_id == user_id:
        return True, task
    # 공유 복사본 소유자
    copy = db.query(Task).filter(
        Task.shared_from_task_id == task_id, Task.user_id == user_id
    ).first()
    if copy:
        return True, task
    # 역방향: 내가 복사본이고 원본에 접근
    if task.shared_from_task_id:
        orig = db.query(Task).filter(
            Task.id == task.shared_from_task_id, Task.user_id == user_id
        ).first()
        if orig:
            return True, task
    # 공개 일정
    if task.visibility in ("public", "selective"):
        return True, task
    return False, None


@router.get("/{task_id}/comments", response_model=list[TaskCommentOut])
def list_comments(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    canonical_id = _get_canonical_task_id(task_id, db)
    ok, _ = _can_access_task(canonical_id, current_user.id, db)
    if not ok:
        raise HTTPException(status_code=403, detail="이 일정에 접근할 수 없습니다.")
    comments = (
        db.query(TaskComment)
        .filter(TaskComment.task_id == canonical_id)
        .order_by(TaskComment.created_at.asc())
        .all()
    )
    return [
        TaskCommentOut(
            id=c.id, task_id=c.task_id, user_id=c.user_id,
            nickname=c.user.nickname if c.user else None,
            content=c.content, parent_id=c.parent_id, created_at=c.created_at,
        )
        for c in comments
    ]


@router.post("/{task_id}/comments", response_model=TaskCommentOut)
def create_comment(
    task_id: int, body: TaskCommentCreate,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    canonical_id = _get_canonical_task_id(task_id, db)
    ok, _ = _can_access_task(canonical_id, current_user.id, db)
    if not ok:
        raise HTTPException(status_code=403, detail="이 일정에 댓글을 달 수 없습니다.")
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="댓글 내용을 입력해주세요.")
    comment = TaskComment(
        task_id=canonical_id, user_id=current_user.id,
        content=body.content.strip(), parent_id=body.parent_id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return TaskCommentOut(
        id=comment.id, task_id=comment.task_id, user_id=comment.user_id,
        nickname=current_user.nickname, content=comment.content,
        parent_id=comment.parent_id, created_at=comment.created_at,
    )


@router.delete("/{task_id}/comments/{comment_id}", status_code=204)
def delete_comment(
    task_id: int, comment_id: int,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    canonical_id = _get_canonical_task_id(task_id, db)
    comment = db.query(TaskComment).filter(
        TaskComment.id == comment_id, TaskComment.task_id == canonical_id,
        TaskComment.user_id == current_user.id,
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    db.delete(comment)
    db.commit()
