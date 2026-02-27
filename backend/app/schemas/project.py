from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ProjectTaskCreate(BaseModel):
    title: str
    estimated_hours: Optional[float] = None
    difficulty: Optional[int] = None  # 1-5
    order_index: int = 0
    memo: Optional[str] = None
    deadline: Optional[str] = None  # YYYY-MM-DD


class ProjectTaskUpdate(BaseModel):
    title: Optional[str] = None
    estimated_hours: Optional[float] = None
    difficulty: Optional[int] = None
    is_done: Optional[bool] = None
    order_index: Optional[int] = None
    memo: Optional[str] = None
    deadline: Optional[str] = None  # YYYY-MM-DD


class ProjectTaskOut(BaseModel):
    id: int
    project_id: int
    title: str
    estimated_hours: Optional[float] = None
    difficulty: Optional[int] = None
    is_done: bool
    done_at: Optional[datetime] = None
    order_index: int
    memo: Optional[str] = None
    deadline: Optional[str] = None  # YYYY-MM-DD
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectStatsOut(BaseModel):
    total_tasks: int
    done_tasks: int
    completion_pct: float
    pace_per_day: float
    days_elapsed: int
    deadline_pct: Optional[float] = None      # 현재 속도로 마감일까지 예상 달성률
    days_until_deadline: Optional[int] = None
    momentum_drop: bool
    total_estimated_hours: Optional[float] = None


class ProjectCreate(BaseModel):
    goal_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    deadline: Optional[str] = None  # YYYY-MM-DD; 없으면 goal.type 으로 계산


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[str] = None
    goal_id: Optional[int] = None


class ProjectOut(BaseModel):
    id: int
    user_id: int
    goal_id: Optional[int] = None
    goal_text: Optional[str] = None
    title: str
    description: Optional[str] = None
    deadline: Optional[str] = None
    created_at: datetime
    tasks: list[ProjectTaskOut]
    stats: ProjectStatsOut

    class Config:
        from_attributes = True
