from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    nickname: str | None = None


class UserOut(BaseModel):
    id: int
    email: EmailStr
    nickname: str | None = None

    class Config:
        from_attributes = True


class UserPublicOut(BaseModel):
    id: int
    nickname: str | None = None
    email: str | None = None

    class Config:
        from_attributes = True


class NicknameUpdate(BaseModel):
    nickname: str
