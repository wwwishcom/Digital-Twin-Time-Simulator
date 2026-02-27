from datetime import datetime
from pydantic import BaseModel


class GoalCreate(BaseModel):
    text: str
    type: str = "daily"


class GoalBulkCreate(BaseModel):
    goals: list[GoalCreate]


class GoalOut(BaseModel):
    id: int
    user_id: int
    text: str
    type: str
    created_at: datetime

    class Config:
        from_attributes = True
