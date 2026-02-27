from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.group import GroupMember
from app.models.log_entry import LogEntry
from app.models.project_task import ProjectTask
from app.models.user import User

router = APIRouter(prefix="/groups", tags=["group-stats"])


def _require_member(db: Session, group_id: int, user_id: int):
    m = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == user_id,
    ).first()
    if not m:
        raise HTTPException(status_code=403, detail="그룹 멤버가 아닙니다.")


@router.get("/{group_id}/stats")
def get_group_stats(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_member(db, group_id, current_user.id)

    members = db.query(GroupMember).filter(GroupMember.group_id == group_id).all()
    member_ids = [m.user_id for m in members]

    seven_days_ago = datetime.utcnow() - timedelta(days=7)

    member_activity = []
    all_sleep_values = []

    for uid in member_ids:
        user = db.query(User).filter(User.id == uid).first()
        nickname = user.nickname if user and user.nickname else (user.email.split("@")[0] if user else f"User#{uid}")

        # 수면 평균 (7일)
        sleep_logs = db.query(LogEntry).filter(
            LogEntry.user_id == uid,
            LogEntry.type == "sleep",
            LogEntry.timestamp >= seven_days_ago,
        ).all()
        avg_sleep = (
            round(sum(float(l.value) for l in sleep_logs) / len(sleep_logs), 1)
            if sleep_logs else None
        )
        if avg_sleep is not None:
            all_sleep_values.append(avg_sleep)

        # 개인 프로젝트 태스크 완료 수
        done_count = db.query(ProjectTask).filter(
            ProjectTask.project.has(user_id=uid),
            ProjectTask.is_done == True,
        ).count()
        total_count = db.query(ProjectTask).filter(
            ProjectTask.project.has(user_id=uid),
        ).count()
        project_progress = round((done_count / total_count) * 100, 1) if total_count > 0 else 0.0

        member_activity.append({
            "user_id": uid,
            "nickname": nickname,
            "avg_sleep": avg_sleep,
            "project_done_count": done_count,
            "project_progress_pct": project_progress,
        })

    avg_sleep_7d = (
        round(sum(all_sleep_values) / len(all_sleep_values), 1)
        if all_sleep_values else None
    )

    all_progress = [m["project_progress_pct"] for m in member_activity]
    avg_project_progress = (
        round(sum(all_progress) / len(all_progress), 1)
        if all_progress else 0.0
    )

    return {
        "avg_sleep_7d": avg_sleep_7d,
        "avg_project_progress": avg_project_progress,
        "member_activity": member_activity,
    }
