from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from typing import Optional

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.project_task import ProjectTask
from app.models.goal import Goal
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectOut,
    ProjectTaskCreate, ProjectTaskUpdate, ProjectTaskOut, ProjectStatsOut,
)

router = APIRouter(prefix="/projects", tags=["projects"])

GOAL_TYPE_DAYS = {
    "daily": 1,
    "weekly": 7,
    "monthly": 30,
    "6months": 180,
    "1year": 365,
}


def _compute_stats(project: Project) -> ProjectStatsOut:
    today = date.today()
    tasks = project.tasks
    total = len(tasks)
    done = [t for t in tasks if t.is_done]
    done_count = len(done)

    completion_pct = done_count / total * 100 if total > 0 else 0
    days_elapsed = max((today - project.created_at.date()).days, 1)
    pace = done_count / days_elapsed  # tasks/day

    total_est = sum(t.estimated_hours for t in tasks if t.estimated_hours) or None

    deadline_pct = None
    days_until_deadline = None
    if project.deadline:
        try:
            deadline_date = date.fromisoformat(project.deadline)
            days_until = (deadline_date - today).days
            days_until_deadline = days_until
            if total > 0 and days_until >= 0:
                if pace > 0:
                    projected_done = done_count + pace * days_until
                    deadline_pct = min(projected_done / total * 100, 100)
                else:
                    deadline_pct = completion_pct
        except ValueError:
            pass

    # 모멘텀 하락: 최근 3일 완료한 할 일이 없고, 이미 시작된 프로젝트
    three_days_ago = today - timedelta(days=3)
    recent_done = [
        t for t in done
        if t.done_at and t.done_at.date() >= three_days_ago
    ]
    momentum_drop = done_count > 0 and len(recent_done) == 0

    return ProjectStatsOut(
        total_tasks=total,
        done_tasks=done_count,
        completion_pct=round(completion_pct, 1),
        pace_per_day=round(pace, 4),
        days_elapsed=days_elapsed,
        deadline_pct=round(deadline_pct, 1) if deadline_pct is not None else None,
        days_until_deadline=days_until_deadline,
        momentum_drop=momentum_drop,
        total_estimated_hours=total_est,
    )


def _to_out(p: Project) -> ProjectOut:
    return ProjectOut(
        id=p.id,
        user_id=p.user_id,
        goal_id=p.goal_id,
        goal_text=p.goal.text if p.goal else None,
        title=p.title,
        description=p.description,
        deadline=p.deadline,
        created_at=p.created_at,
        tasks=p.tasks,
        stats=_compute_stats(p),
    )


# ── 프로젝트 CRUD ────────────────────────────────────────────────────────────

@router.get("", response_model=list[ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    projects = (
        db.query(Project)
        .filter(Project.user_id == current_user.id)
        .order_by(Project.created_at.asc())
        .all()
    )
    return [_to_out(p) for p in projects]


@router.post("", response_model=ProjectOut)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deadline = payload.deadline
    if not deadline and payload.goal_id:
        goal = db.query(Goal).filter(
            Goal.id == payload.goal_id, Goal.user_id == current_user.id
        ).first()
        if goal:
            days = GOAL_TYPE_DAYS.get(goal.type, 30)
            deadline = (goal.created_at.date() + timedelta(days=days)).isoformat()

    project = Project(
        user_id=current_user.id,
        goal_id=payload.goal_id,
        title=payload.title,
        description=payload.description,
        deadline=deadline,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _to_out(project)


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(project, k, v)
    db.commit()
    db.refresh(project)
    return _to_out(project)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    db.delete(project)
    db.commit()


# ── 할 일 CRUD ───────────────────────────────────────────────────────────────

@router.post("/{project_id}/tasks", response_model=ProjectTaskOut)
def add_task(
    project_id: int,
    payload: ProjectTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    task = ProjectTask(
        project_id=project_id,
        title=payload.title,
        estimated_hours=payload.estimated_hours,
        difficulty=payload.difficulty,
        order_index=payload.order_index,
        memo=payload.memo,
        deadline=payload.deadline,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.put("/{project_id}/tasks/{task_id}", response_model=ProjectTaskOut)
def update_task(
    project_id: int,
    task_id: int,
    payload: ProjectTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    task = db.query(ProjectTask).filter(
        ProjectTask.id == task_id, ProjectTask.project_id == project_id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="할 일을 찾을 수 없습니다.")

    data = payload.model_dump(exclude_unset=True)
    if "is_done" in data:
        if data["is_done"] and not task.is_done:
            data["done_at"] = datetime.utcnow()
        elif not data["is_done"]:
            data["done_at"] = None
    for k, v in data.items():
        setattr(task, k, v)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{project_id}/tasks/{task_id}", status_code=204)
def delete_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    task = db.query(ProjectTask).filter(
        ProjectTask.id == task_id, ProjectTask.project_id == project_id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="할 일을 찾을 수 없습니다.")
    db.delete(task)
    db.commit()


# ── Twinny AI 피드백 ──────────────────────────────────────────────────────────

@router.post("/{project_id}/twinny-feedback")
def project_twinny_feedback(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    from app.models.log_entry import LogEntry
    from app.models.life_score import LifeScore
    from datetime import timedelta

    seven_days_ago = datetime.utcnow() - timedelta(days=7)

    # 최근 7일 수면 평균
    sleep_logs = db.query(LogEntry).filter(
        LogEntry.user_id == current_user.id,
        LogEntry.type == "sleep",
        LogEntry.timestamp >= seven_days_ago,
    ).all()
    avg_sleep = (
        round(sum(float(l.value) for l in sleep_logs) / len(sleep_logs), 1)
        if sleep_logs else None
    )

    # 가장 최근 LifeScore
    latest_score = (
        db.query(LifeScore)
        .filter(LifeScore.user_id == current_user.id)
        .order_by(LifeScore.date.desc())
        .first()
    )

    life_context = {
        "avg_sleep": avg_sleep,
        "energy": latest_score.energy if latest_score else None,
        "focus": latest_score.focus if latest_score else None,
        "mental": latest_score.mental if latest_score else None,
    }

    nickname = current_user.nickname or current_user.email.split("@")[0]

    from app.services.project_twinny_service import generate_project_twinny_feedback
    return generate_project_twinny_feedback(project, project.tasks, nickname, life_context)
