from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime, date, timezone
from typing import Optional, List
import json

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.log_entry import LogEntry
from app.models.friendship import Friendship
from app.schemas.log_entry import LogEntryCreate, LogEntryOut, DailyAggregateOut

router = APIRouter(prefix="/logs", tags=["logs"])


@router.post("", response_model=LogEntryOut)
def create_log(
    payload: LogEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ts = payload.timestamp or datetime.now(timezone.utc).replace(tzinfo=None)
    entry = LogEntry(
        user_id=current_user.id,
        type=payload.type,
        timestamp=ts,
        value=payload.value,
        meta=payload.meta,
        note=payload.note,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("", response_model=list[LogEntryOut])
def list_logs(
    type: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(LogEntry).filter(LogEntry.user_id == current_user.id)
    if type:
        q = q.filter(LogEntry.type == type)
    if date_from:
        q = q.filter(func.date(LogEntry.timestamp) >= date_from)
    if date_to:
        q = q.filter(func.date(LogEntry.timestamp) <= date_to)
    entries = q.order_by(LogEntry.timestamp.desc()).limit(limit).all()
    return entries


@router.get("/friends", response_model=list[LogEntryOut])
def friends_logs(
    types: Optional[List[str]] = Query(default=None),
    log_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_date = log_date or date.today()
    friendships = db.query(Friendship).filter(
        or_(Friendship.user_id == current_user.id, Friendship.friend_id == current_user.id),
        Friendship.status == "accepted",
    ).all()
    friend_ids = [
        f.friend_id if f.user_id == current_user.id else f.user_id
        for f in friendships
    ]
    if not friend_ids:
        return []
    q = db.query(LogEntry).filter(
        LogEntry.user_id.in_(friend_ids),
        func.date(LogEntry.timestamp) == target_date,
    )
    if types:
        q = q.filter(LogEntry.type.in_(types))
    return q.order_by(LogEntry.user_id, LogEntry.timestamp.desc()).all()


@router.delete("/{log_id}", status_code=204)
def delete_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(LogEntry).filter(
        LogEntry.id == log_id,
        LogEntry.user_id == current_user.id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="로그를 찾을 수 없습니다.")
    db.delete(entry)
    db.commit()
