import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.schedule_draft import ScheduleDraft
from app.schemas.schedule_draft import ScheduleDraftCreate, ScheduleDraftOut, ScheduleDraftEvent
from app.services.plan_service import generate_draft, apply_draft

router = APIRouter(prefix="/plan", tags=["plan"])


@router.post("/drafts", response_model=ScheduleDraftOut)
def create_draft(
    payload: ScheduleDraftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    draft = generate_draft(
        db=db,
        user_id=current_user.id,
        plan_name=payload.plan_name,
        changes=payload.changes or {},
        horizon_days=payload.horizon_days or 7,
        preferences=None,
    )
    return _to_out(draft)


@router.get("/drafts", response_model=list[ScheduleDraftOut])
def list_drafts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    drafts = (
        db.query(ScheduleDraft)
        .filter(ScheduleDraft.user_id == current_user.id)
        .order_by(ScheduleDraft.created_at.desc())
        .limit(20)
        .all()
    )
    return [_to_out(d) for d in drafts]


@router.get("/drafts/{draft_id}", response_model=ScheduleDraftOut)
def get_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    draft = _get_or_404(db, draft_id, current_user.id)
    return _to_out(draft)


@router.put("/drafts/{draft_id}", response_model=ScheduleDraftOut)
def update_draft(
    draft_id: int,
    events: list[ScheduleDraftEvent],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """사용자가 편집한 이벤트 목록으로 초안 업데이트"""
    draft = _get_or_404(db, draft_id, current_user.id)
    draft.events = json.dumps([e.model_dump() for e in events], ensure_ascii=False)
    db.commit()
    db.refresh(draft)
    return _to_out(draft)


@router.post("/drafts/{draft_id}/apply")
def apply_draft_to_calendar(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """초안 이벤트를 Task로 일괄 등록하고 캘린더에 반영"""
    draft = _get_or_404(db, draft_id, current_user.id)
    if draft.status == "applied":
        raise HTTPException(status_code=400, detail="이미 적용된 초안입니다.")
    count = apply_draft(db, draft)
    return {"message": f"{count}개의 일정이 캘린더에 추가되었습니다.", "task_count": count}


def _get_or_404(db: Session, draft_id: int, user_id: int) -> ScheduleDraft:
    draft = db.query(ScheduleDraft).filter(
        ScheduleDraft.id == draft_id,
        ScheduleDraft.user_id == user_id,
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="초안을 찾을 수 없습니다.")
    return draft


def _to_out(draft: ScheduleDraft) -> ScheduleDraftOut:
    try:
        raw = json.loads(draft.events) if draft.events else []
    except (json.JSONDecodeError, TypeError):
        raw = []
    events = [ScheduleDraftEvent(**e) for e in raw]
    return ScheduleDraftOut(
        id=draft.id,
        user_id=draft.user_id,
        plan_name=draft.plan_name,
        events=events,
        status=draft.status,
        created_at=draft.created_at,
    )
