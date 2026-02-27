from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.friendship import Friendship
from app.models.goal import Goal
from app.models.group import Group, GroupMember
from app.models.task import Task
from app.models.task_visibility import TaskVisibilityFriend
from app.models.user import User
from app.schemas.group import GroupCreate, GroupOut, GroupDetailOut, AddMemberPayload
from app.schemas.goal import GoalOut
from app.schemas.task import TaskOut
from app.schemas.user import UserPublicOut

router = APIRouter(prefix="/groups", tags=["groups"])


def _get_member(db: Session, group_id: int, user_id: int):
    return db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id,
    ).first()


def _are_friends(db: Session, a: int, b: int) -> bool:
    fr = db.query(Friendship).filter(
        or_(
            and_(Friendship.user_id == a, Friendship.friend_id == b),
            and_(Friendship.user_id == b, Friendship.friend_id == a),
        ),
        Friendship.status == "accepted",
    ).first()
    return fr is not None


@router.get("", response_model=list[GroupOut])
def list_groups(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    memberships = db.query(GroupMember).filter(GroupMember.user_id == current_user.id).all()
    group_ids = [m.group_id for m in memberships]
    groups = db.query(Group).filter(Group.id.in_(group_ids)).all()
    result = []
    for g in groups:
        count = db.query(GroupMember).filter(GroupMember.group_id == g.id).count()
        result.append(GroupOut(
            id=g.id, owner_id=g.owner_id, name=g.name,
            created_at=g.created_at, member_count=count,
        ))
    return result


@router.post("", response_model=GroupOut)
def create_group(payload: GroupCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="그룹 이름을 입력해주세요")
    group = Group(owner_id=current_user.id, name=name)
    db.add(group)
    db.flush()
    db.add(GroupMember(group_id=group.id, user_id=current_user.id))
    db.commit()
    db.refresh(group)
    return GroupOut(id=group.id, owner_id=group.owner_id, name=group.name,
                    created_at=group.created_at, member_count=1)


@router.get("/{group_id}", response_model=GroupDetailOut)
def get_group(group_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not _get_member(db, group_id, current_user.id):
        raise HTTPException(status_code=403, detail="그룹 멤버가 아닙니다")
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다")
    members = db.query(User).join(GroupMember, GroupMember.user_id == User.id).filter(
        GroupMember.group_id == group_id
    ).all()
    return GroupDetailOut(
        id=group.id, owner_id=group.owner_id, name=group.name,
        created_at=group.created_at,
        members=[UserPublicOut(id=u.id, nickname=u.nickname) for u in members],
    )


@router.post("/{group_id}/members", response_model=GroupDetailOut)
def add_member(group_id: int, payload: AddMemberPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다")
    if group.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="그룹 소유자만 멤버를 추가할 수 있습니다")
    if not _are_friends(db, current_user.id, payload.user_id):
        raise HTTPException(status_code=400, detail="친구만 그룹에 초대할 수 있습니다")
    if _get_member(db, group_id, payload.user_id):
        raise HTTPException(status_code=400, detail="이미 그룹 멤버입니다")
    db.add(GroupMember(group_id=group_id, user_id=payload.user_id))
    db.commit()
    return get_group(group_id, db, current_user)


@router.delete("/{group_id}/members/{user_id}")
def remove_member(group_id: int, user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다")
    if current_user.id != user_id and group.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="권한이 없습니다")
    member = _get_member(db, group_id, user_id)
    if not member:
        raise HTTPException(status_code=404, detail="멤버를 찾을 수 없습니다")
    db.delete(member)
    remaining = db.query(GroupMember).filter(GroupMember.group_id == group_id).count()
    if remaining == 0:
        db.query(Group).filter(Group.id == group_id).delete()
    db.commit()
    return {"deleted": True}


@router.get("/{group_id}/feed")
def get_group_feed(group_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not _get_member(db, group_id, current_user.id):
        raise HTTPException(status_code=403, detail="그룹 멤버가 아닙니다")
    members_rows = db.query(GroupMember).filter(GroupMember.group_id == group_id).all()
    member_ids = [m.user_id for m in members_rows]

    selective_ids = db.query(TaskVisibilityFriend.task_id).filter(
        TaskVisibilityFriend.friend_user_id == current_user.id
    ).subquery()

    tasks = db.query(Task).filter(
        Task.user_id.in_(member_ids),
        or_(
            Task.visibility == "public",
            and_(Task.visibility == "selective", Task.id.in_(selective_ids)),
        ),
    ).order_by(Task.start_at.asc()).all()

    goals = db.query(Goal).filter(Goal.user_id.in_(member_ids)).order_by(Goal.created_at.asc()).all()

    members = db.query(User).join(GroupMember, GroupMember.user_id == User.id).filter(
        GroupMember.group_id == group_id
    ).all()

    return {
        "tasks": [TaskOut.model_validate(t) for t in tasks],
        "goals": [GoalOut.model_validate(g) for g in goals],
        "members": [UserPublicOut(id=u.id, nickname=u.nickname) for u in members],
    }
