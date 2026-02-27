from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class GroupGoalCreate(BaseModel):
    title: str
    target_date: Optional[str] = None


class GroupGoalOut(BaseModel):
    id: int
    group_id: int
    created_by: int
    title: str
    target_date: Optional[str]
    status: str
    achievement_rate: float
    created_at: datetime

    model_config = {"from_attributes": True}
