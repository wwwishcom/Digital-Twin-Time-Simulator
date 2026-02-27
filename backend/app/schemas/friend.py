from datetime import datetime
from pydantic import BaseModel

from app.schemas.user import UserPublicOut


class FriendRequestPayload(BaseModel):
    friend_id: int


class FriendRequestOut(BaseModel):
    id: int
    user_id: int
    friend_id: int
    status: str
    created_at: datetime
    requester: UserPublicOut
    recipient: UserPublicOut

    class Config:
        from_attributes = True


class FriendOut(BaseModel):
    id: int
    user: UserPublicOut
    since: datetime


class FriendSearchResult(BaseModel):
    id: int
    nickname: str
    already_friend: bool
    request_pending: bool
