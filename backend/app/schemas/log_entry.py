from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class LogEntryCreate(BaseModel):
    type: str = Field(..., pattern="^(health|study|spend|sleep|mood)$")
    timestamp: Optional[datetime] = None  # None이면 서버에서 현재 시각 사용
    value: float
    meta: Optional[str] = None   # JSON 문자열
    note: Optional[str] = Field(None, max_length=500)


class LogEntryOut(BaseModel):
    id: int
    user_id: int
    type: str
    timestamp: datetime
    value: float
    meta: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DailyAggregateOut(BaseModel):
    id: int
    user_id: int
    date: str       # YYYY-MM-DD
    type: str
    total: float
    average: float
    count: int
    meta_summary: Optional[str] = None
    computed_at: datetime

    model_config = {"from_attributes": True}
