from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ScheduleDraftEvent(BaseModel):
    title: str
    category: str = "general"
    start_at: str    # ISO8601
    end_at: str      # ISO8601
    note: Optional[str] = None
    status: str = "planned"


class ScheduleDraftCreate(BaseModel):
    plan_name: str = Field(..., max_length=100)
    events: list[ScheduleDraftEvent]
    # what-if 입력 파라미터 (changes, horizon_days) 를 그대로 사용해 생성하는 경우
    changes: Optional[dict] = None
    horizon_days: Optional[int] = 7


class ScheduleDraftOut(BaseModel):
    id: int
    user_id: int
    plan_name: str
    events: list[ScheduleDraftEvent]
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
