from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.group import Group, GroupMember
from app.models.group_project import GroupProject
from app.models.group_project_task import GroupProjectTask
from app.models.user import User
from app.schemas.group_project import (
    GroupProjectCreate, GroupProjectUpdate, GroupProjectOut,
    GroupProjectTaskCreate, GroupProjectTaskUpdate,
    GroupProjectTaskOut, GroupProjectStats,
)

router = APIRouter(prefix="/groups", tags=["group-projects"])


def _require_member(db: Session, group_id: int, user_id: int):
    m = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="그룹 멤버가 아닙니다.")
    return m


def _build_task_out(task: GroupProjectTask) -> GroupProjectTaskOut:
    today = date.today()
    is_overdue = bool(
        task.deadline
        and not task.is_done
        and date.fromisoformat(task.deadline) < today
    )
    nickname = None
    if task.assignee:
        nickname = task.assignee.nickname or task.assignee.email.split("@")[0]
    return GroupProjectTaskOut(
        id=task.id,
        group_project_id=task.group_project_id,
        assigned_to=task.assigned_to,
        assigned_nickname=nickname,
        title=task.title,
        deadline=task.deadline,
        is_done=task.is_done,
        done_at=task.done_at,
        order_index=task.order_index,
        is_overdue=is_overdue,
        overdue_recorded=task.overdue_recorded,
        created_at=task.created_at,
    )


def _build_project_out(project: GroupProject, db: Session) -> GroupProjectOut:
    today = date.today()
    task_outs = []
    overdue_count = 0
    tasks_to_update = []

    for task in project.tasks:
        is_overdue = bool(
            task.deadline
            and not task.is_done
            and date.fromisoformat(task.deadline) < today
        )
        # 기록 보존: 처음 overdue 감지 시 DB 업데이트
        if is_overdue and not task.overdue_recorded:
            task.overdue_recorded = True
            tasks_to_update.append(task)
        if is_overdue or task.overdue_recorded:
            overdue_count += 1

        nickname = None
        if task.assignee:
            nickname = task.assignee.nickname or task.assignee.email.split("@")[0]

        task_outs.append(GroupProjectTaskOut(
            id=task.id,
            group_project_id=task.group_project_id,
            assigned_to=task.assigned_to,
            assigned_nickname=nickname,
            title=task.title,
            deadline=task.deadline,
            is_done=task.is_done,
            done_at=task.done_at,
            order_index=task.order_index,
            is_overdue=is_overdue,
            overdue_recorded=task.overdue_recorded,
            created_at=task.created_at,
        ))

    if tasks_to_update:
        db.commit()

    total = len(task_outs)
    done = sum(1 for t in task_outs if t.is_done)
    completion_pct = round((done / total) * 100, 1) if total > 0 else 0.0

    return GroupProjectOut(
        id=project.id,
        group_id=project.group_id,
        created_by=project.created_by,
        title=project.title,
        description=project.description,
        deadline=project.deadline,
        status=project.status,
        tasks=task_outs,
        stats=GroupProjectStats(
            completion_pct=completion_pct,
            total=total,
            done=done,
            overdue_count=overdue_count,
        ),
        created_at=project.created_at,
    )


# ── 프로젝트 CRUD ─────────────────────────────────────────────────────────

@router.get("/{group_id}/projects", response_model=list[GroupProjectOut])
def list_group_projects(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.id)
    projects = (
        db.query(GroupProject)
        .filter(GroupProject.group_id == group_id)
        .order_by(GroupProject.created_at.desc())
        .all()
    )
    return [_build_project_out(p, db) for p in projects]


@router.post("/{group_id}/projects", response_model=GroupProjectOut)
def create_group_project(
    group_id: int,
    payload: GroupProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.id)
    project = GroupProject(
        group_id=group_id,
        created_by=current_user.id,
        title=payload.title,
        description=payload.description,
        deadline=payload.deadline,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _build_project_out(project, db)


@router.put("/{group_id}/projects/{project_id}", response_model=GroupProjectOut)
def update_group_project(
    group_id: int,
    project_id: int,
    payload: GroupProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.id)
    project = db.query(GroupProject).filter(
        GroupProject.id == project_id, GroupProject.group_id == group_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    group = db.query(Group).filter(Group.id == group_id).first()
    if project.created_by != current_user.id and group.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, val)
    db.commit()
    db.refresh(project)
    return _build_project_out(project, db)


@router.delete("/{group_id}/projects/{project_id}", status_code=204)
def delete_group_project(
    group_id: int,
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.id)
    project = db.query(GroupProject).filter(
        GroupProject.id == project_id, GroupProject.group_id == group_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    group = db.query(Group).filter(Group.id == group_id).first()
    if project.created_by != current_user.id and group.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
    db.delete(project)
    db.commit()


# ── 태스크 CRUD ──────────────────────────────────────────────────────────

@router.post("/{group_id}/projects/{project_id}/tasks", response_model=GroupProjectOut)
def add_group_project_task(
    group_id: int,
    project_id: int,
    payload: GroupProjectTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.id)
    project = db.query(GroupProject).filter(
        GroupProject.id == project_id, GroupProject.group_id == group_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    # assigned_to가 있으면 해당 유저가 그룹 멤버인지 확인
    if payload.assigned_to:
        _require_member(db, group_id, payload.assigned_to)
    task = GroupProjectTask(
        group_project_id=project_id,
        assigned_to=payload.assigned_to,
        title=payload.title,
        deadline=payload.deadline,
        order_index=payload.order_index,
    )
    db.add(task)
    db.commit()
    db.refresh(project)
    return _build_project_out(project, db)


@router.put("/{group_id}/projects/{project_id}/tasks/{task_id}", response_model=GroupProjectOut)
def update_group_project_task(
    group_id: int,
    project_id: int,
    task_id: int,
    payload: GroupProjectTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.id)
    task = db.query(GroupProjectTask).filter(
        GroupProjectTask.id == task_id,
        GroupProjectTask.group_project_id == project_id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="태스크를 찾을 수 없습니다.")
    updates = payload.model_dump(exclude_unset=True)
    if "is_done" in updates:
        if updates["is_done"] and not task.is_done:
            task.done_at = datetime.utcnow()
        elif not updates["is_done"]:
            task.done_at = None
    for field, val in updates.items():
        setattr(task, field, val)
    db.commit()
    project = db.query(GroupProject).filter(GroupProject.id == project_id).first()
    db.refresh(project)
    return _build_project_out(project, db)


@router.delete("/{group_id}/projects/{project_id}/tasks/{task_id}", response_model=GroupProjectOut)
def delete_group_project_task(
    group_id: int,
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.id)
    task = db.query(GroupProjectTask).filter(
        GroupProjectTask.id == task_id,
        GroupProjectTask.group_project_id == project_id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="태스크를 찾을 수 없습니다.")
    db.delete(task)
    db.commit()
    project = db.query(GroupProject).filter(GroupProject.id == project_id).first()
    db.refresh(project)
    return _build_project_out(project, db)


# ── AI 피드백 ─────────────────────────────────────────────────────────────

@router.post("/{group_id}/projects/{project_id}/ai-feedback")
def ai_feedback(
    group_id: int,
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.id)
    project = db.query(GroupProject).filter(
        GroupProject.id == project_id, GroupProject.group_id == group_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    # 멤버 활동 데이터 수집
    from app.models.group_project_task import GroupProjectTask as GPT
    from app.models.log_entry import LogEntry
    from sqlalchemy import func
    from datetime import timedelta

    members = db.query(GroupMember).filter(GroupMember.group_id == group_id).all()
    member_users = {
        m.user_id: db.query(User).filter(User.id == m.user_id).first()
        for m in members
    }

    member_activity = []
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    for uid, user in member_users.items():
        sleep_logs = db.query(LogEntry).filter(
            LogEntry.user_id == uid,
            LogEntry.type == "sleep",
            LogEntry.timestamp >= seven_days_ago,
        ).all()
        avg_sleep = (
            sum(float(l.value) for l in sleep_logs) / len(sleep_logs)
            if sleep_logs else None
        )
        # 해당 유저의 그룹 프로젝트 태스크 완료 수
        done_count = db.query(GPT).filter(
            GPT.group_project_id == project_id,
            GPT.assigned_to == uid,
            GPT.is_done == True,
        ).count()
        total_count = db.query(GPT).filter(
            GPT.group_project_id == project_id,
            GPT.assigned_to == uid,
        ).count()
        nickname = user.nickname if user and user.nickname else (user.email.split("@")[0] if user else f"User#{uid}")
        member_activity.append({
            "user_id": uid,
            "nickname": nickname,
            "avg_sleep": round(avg_sleep, 1) if avg_sleep is not None else None,
            "done_count": done_count,
            "total_count": total_count,
        })

    from app.services.group_ai_service import generate_project_feedback
    result = generate_project_feedback(project, project.tasks, member_activity)
    return result
