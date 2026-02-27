from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, NicknameUpdate
from app.schemas.token import Token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/nickname-check")
def nickname_check(nickname: str, db: Session = Depends(get_db)):
    duplicate = db.query(User).filter(User.nickname == nickname.strip()).first()
    return {"duplicate": duplicate is not None}


@router.post("/register", response_model=UserOut)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.email == payload.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="이미 가입된 이메일입니다")

    nickname = payload.nickname.strip() if payload.nickname else None
    if nickname:
        if len(nickname) > 30:
            raise HTTPException(status_code=400, detail="닉네임은 1~30자여야 합니다")
        dup = db.query(User).filter(User.nickname == nickname).first()
        if dup:
            raise HTTPException(status_code=400, detail="중복된 닉네임입니다!")

    user = User(email=payload.email, password_hash=hash_password(payload.password), nickname=nickname)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="이메일 또는 비밀번호가 올바르지 않습니다")

    token = create_access_token(subject=user.email)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me/nickname", response_model=UserOut)
def update_nickname(payload: NicknameUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    nickname = payload.nickname.strip()
    if not nickname or len(nickname) > 30:
        raise HTTPException(status_code=400, detail="닉네임은 1~30자여야 합니다")
    duplicate = db.query(User).filter(User.nickname == nickname, User.id != current_user.id).first()
    if duplicate:
        raise HTTPException(status_code=400, detail="중복된 닉네임입니다!")
    current_user.nickname = nickname
    try:
        db.commit()
        db.refresh(current_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="중복된 닉네임입니다!")
    return current_user
