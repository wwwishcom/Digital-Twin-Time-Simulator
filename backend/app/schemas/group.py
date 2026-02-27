from datetime import datetime
from pydantic import BaseModel

from app.schemas.user import UserPublicOut


class GroupCreate(BaseModel):
    name: str


class AddMemberPayload(BaseModel):
    user_id: int


class GroupOut(BaseModel):
    id: int
    owner_id: int
    name: str
    created_at: datetime
    member_count: int = 0

    class Config:
        from_attributes = True


class GroupDetailOut(BaseModel):
    id: int
    owner_id: int
    name: str
    created_at: datetime
    members: list[UserPublicOut]

    class Config:
        from_attributes = True
