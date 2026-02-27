from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.log_entry import DailyAggregateOut
from app.schemas.life_score import LifeScoreOut
from app.services.score_service import compute_life_score, get_score_range
from app.services.aggregate_service import build_daily_aggregates, get_aggregates_range

router = APIRouter(prefix="/life-scores", tags=["life-scores"])


@router.get("/today", response_model=LifeScoreOut)
def get_today_score(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    return compute_life_score(db, current_user.id, today)


@router.post("/compute", response_model=LifeScoreOut)
def compute_score(
    target_date: date = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = target_date or date.today()
    return compute_life_score(db, current_user.id, d)


@router.get("", response_model=list[LifeScoreOut])
def list_scores(
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    d_from = date_from or (today - timedelta(days=29))
    d_to = date_to or today
    return get_score_range(db, current_user.id, d_from, d_to)


@router.get("/aggregates", response_model=list[DailyAggregateOut])
def list_aggregates(
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    d_from = date_from or (today - timedelta(days=29))
    d_to = date_to or today
    return get_aggregates_range(db, current_user.id, d_from, d_to)
