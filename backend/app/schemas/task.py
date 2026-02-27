from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class TaskCreate(BaseModel):
    title: str
    category: str = "general"
    expected_min: int
    actual_min: int | None = None
    start_at: datetime
    end_at: datetime
    status: str = "planned"
    visibility: str = "private"
    visible_to_user_ids: list[int] = []
    participant_ids: list[int] = []   # 함께 일정 공유할 친구 IDs


class TaskUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    expected_min: int | None = None
    actual_min: int | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    status: str | None = None
    visibility: str | None = None
    visible_to_user_ids: list[int] | None = None


class TaskOut(BaseModel):
    id: int
    user_id: int
    title: str
    category: str
    expected_min: int
    actual_min: int | None
    start_at: datetime
    end_at: datetime
    status: str
    visibility: str
    shared_from_task_id: int | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── 댓글 스키마 ──────────────────────────────────────────────────────────────
class TaskCommentCreate(BaseModel):
    content: str
    parent_id: Optional[int] = None


class TaskCommentOut(BaseModel):
    id: int
    task_id: int
    user_id: int
    nickname: Optional[str] = None
    content: str
    parent_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
