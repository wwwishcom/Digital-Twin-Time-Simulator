from __future__ import annotations
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, model_validator


class GroupProjectTaskCreate(BaseModel):
    title: str
    deadline: Optional[str] = None
    assigned_to: Optional[int] = None
    order_index: int = 0


class GroupProjectTaskUpdate(BaseModel):
    title: Optional[str] = None
    deadline: Optional[str] = None
    assigned_to: Optional[int] = None
    is_done: Optional[bool] = None
    order_index: Optional[int] = None


class GroupProjectTaskOut(BaseModel):
    id: int
    group_project_id: int
    assigned_to: Optional[int]
    assigned_nickname: Optional[str]
    title: str
    deadline: Optional[str]
    is_done: bool
    done_at: Optional[datetime]
    order_index: int
    is_overdue: bool
    overdue_recorded: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class GroupProjectStats(BaseModel):
    completion_pct: float
    total: int
    done: int
    overdue_count: int


class GroupProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None
    deadline: Optional[str] = None


class GroupProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[str] = None


class GroupProjectOut(BaseModel):
    id: int
    group_id: int
    created_by: int
    title: str
    description: Optional[str]
    deadline: Optional[str]
    status: str
    tasks: List[GroupProjectTaskOut]
    stats: GroupProjectStats
    created_at: datetime

    model_config = {"from_attributes": True}
