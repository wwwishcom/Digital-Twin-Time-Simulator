from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.group import Group, GroupMember
from app.models.group_goal import GroupGoal
from app.models.group_project_task import GroupProjectTask
from app.models.group_project import GroupProject
from app.models.user import User
from app.schemas.group_goal import GroupGoalCreate, GroupGoalOut

router = APIRouter(prefix="/groups", tags=["group-goals"])


def _require_member(db: Session, group_id: int, user_id: int):
    m = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="그룹 멤버가 아닙니다.")
    return m


def _calc_achievement_rate(db: Session, group_id: int) -> float:
    """그룹 프로젝트 태스크 완료율 → 그룹 목표 달성률"""
    projects = db.query(GroupProject).filter(GroupProject.group_id == group_id).all()
    if not projects:
        return 0.0
    project_ids = [p.id for p in projects]
    all_tasks = db.query(GroupProjectTask).filter(
        GroupProjectTask.group_project_id.in_(project_ids)
    ).all()
    if not all_tasks:
        return 0.0
    done = sum(1 for t in all_tasks if t.is_done)
    return round(done / len(all_tasks), 4)


@router.get("/{group_id}/goals", response_model=list[GroupGoalOut])
def list_group_goals(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.id)
    goals = db.query(GroupGoal).filter(GroupGoal.group_id == group_id).all()
    rate = _calc_achievement_rate(db, group_id)
    result = []
    for g in goals:
        out = GroupGoalOut(
            id=g.id,
            group_id=g.group_id,
            created_by=g.created_by,
            title=g.title,
            target_date=g.target_date,
            status=g.status,
            achievement_rate=rate,
            created_at=g.created_at,
        )
        result.append(out)
    return result


@router.post("/{group_id}/goals", response_model=GroupGoalOut)
def create_group_goal(
    group_id: int,
    payload: GroupGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.id)
    goal = GroupGoal(
        group_id=group_id,
        created_by=current_user.id,
        title=payload.title,
        target_date=payload.target_date,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    rate = _calc_achievement_rate(db, group_id)
    return GroupGoalOut(
        id=goal.id,
        group_id=goal.group_id,
        created_by=goal.created_by,
        title=goal.title,
        target_date=goal.target_date,
        status=goal.status,
        achievement_rate=rate,
        created_at=goal.created_at,
    )


@router.delete("/{group_id}/goals/{goal_id}", status_code=204)
def delete_group_goal(
    group_id: int,
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.id)
    goal = db.query(GroupGoal).filter(
        GroupGoal.id == goal_id, GroupGoal.group_id == group_id
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="목표를 찾을 수 없습니다.")
    group = db.query(Group).filter(Group.id == group_id).first()
    if goal.created_by != current_user.id and group.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
    db.delete(goal)
    db.commit()
