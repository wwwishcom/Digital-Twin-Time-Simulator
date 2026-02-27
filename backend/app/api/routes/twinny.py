from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.life_score import TwinnySummaryOut
from app.services.twinny_service import get_twinny_summary

router = APIRouter(prefix="/twinny", tags=["twinny"])


@router.get("/summary", response_model=TwinnySummaryOut)
def twinny_summary(
    target_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = target_date or date.today()
    return get_twinny_summary(db, current_user.id, d)
