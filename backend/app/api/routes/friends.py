from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, get_current_user
from app.models.friendship import Friendship
from app.models.task import Task
from app.models.task_visibility import TaskVisibilityFriend
from app.models.user import User
from app.schemas.friend import FriendRequestOut, FriendRequestPayload, FriendOut, FriendSearchResult
from app.schemas.task import TaskOut

router = APIRouter(prefix="/friends", tags=["friends"])


def _get_friendship(db: Session, user_id_a: int, user_id_b: int):
    return db.query(Friendship).filter(
        or_(
            and_(Friendship.user_id == user_id_a, Friendship.friend_id == user_id_b),
            and_(Friendship.user_id == user_id_b, Friendship.friend_id == user_id_a),
        )
    ).first()


def _are_friends(db: Session, user_id_a: int, user_id_b: int) -> bool:
    fr = _get_friendship(db, user_id_a, user_id_b)
    return fr is not None and fr.status == "accepted"


@router.get("/search", response_model=list[FriendSearchResult])
def search_users(nickname: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not nickname:
        return []
    users = db.query(User).filter(
        User.nickname.ilike(f"%{nickname}%"),
        User.id != current_user.id,
        User.nickname.isnot(None),
    ).limit(20).all()

    results = []
    for u in users:
        fr = _get_friendship(db, current_user.id, u.id)
        results.append(FriendSearchResult(
            id=u.id,
            nickname=u.nickname,
            already_friend=fr is not None and fr.status == "accepted",
            request_pending=fr is not None and fr.status == "pending",
        ))
    return results


@router.post("/request", response_model=FriendRequestOut)
def send_friend_request(payload: FriendRequestPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.friend_id == current_user.id:
        raise HTTPException(status_code=400, detail="자기 자신에게 친구 신청할 수 없습니다")
    target = db.query(User).filter(User.id == payload.friend_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")
    existing = _get_friendship(db, current_user.id, payload.friend_id)
    if existing:
        raise HTTPException(status_code=400, detail="이미 친구이거나 신청 중입니다")
    fr = Friendship(user_id=current_user.id, friend_id=payload.friend_id, status="pending")
    db.add(fr)
    db.commit()
    db.refresh(fr)
    return fr


@router.get("/requests", response_model=list[FriendRequestOut])
def list_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Friendship).options(
        joinedload(Friendship.requester),
        joinedload(Friendship.recipient),
    ).filter(
        Friendship.friend_id == current_user.id,
        Friendship.status == "pending",
    ).all()


@router.post("/requests/{request_id}/accept", response_model=FriendRequestOut)
def accept_request(request_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    fr = db.query(Friendship).filter(
        Friendship.id == request_id,
        Friendship.friend_id == current_user.id,
        Friendship.status == "pending",
    ).first()
    if not fr:
        raise HTTPException(status_code=404, detail="친구 신청을 찾을 수 없습니다")
    fr.status = "accepted"
    db.commit()
    db.refresh(fr)
    return fr


@router.delete("/requests/{request_id}")
def decline_or_cancel_request(request_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    fr = db.query(Friendship).filter(Friendship.id == request_id).first()
    if not fr:
        raise HTTPException(status_code=404, detail="친구 신청을 찾을 수 없습니다")
    if current_user.id not in (fr.user_id, fr.friend_id):
        raise HTTPException(status_code=403, detail="권한이 없습니다")
    db.delete(fr)
    db.commit()
    return {"deleted": True}


@router.get("", response_model=list[FriendOut])
def list_friends(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sent = db.query(Friendship).filter(
        Friendship.user_id == current_user.id,
        Friendship.status == "accepted",
    ).all()
    received = db.query(Friendship).filter(
        Friendship.friend_id == current_user.id,
        Friendship.status == "accepted",
    ).all()
    result = []
    for f in sent:
        result.append(FriendOut(id=f.id, user=f.recipient, since=f.created_at))
    for f in received:
        result.append(FriendOut(id=f.id, user=f.requester, since=f.created_at))
    return result


@router.delete("/{friendship_id}")
def remove_friend(friendship_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    fr = db.query(Friendship).filter(Friendship.id == friendship_id).first()
    if not fr:
        raise HTTPException(status_code=404, detail="친구 관계를 찾을 수 없습니다")
    if current_user.id not in (fr.user_id, fr.friend_id):
        raise HTTPException(status_code=403, detail="권한이 없습니다")
    other_id = fr.friend_id if fr.user_id == current_user.id else fr.user_id
    db.delete(fr)
    # selective 공유 목록에서도 제거
    db.query(TaskVisibilityFriend).filter(
        TaskVisibilityFriend.friend_user_id == other_id
    ).delete()
    db.commit()
    return {"deleted": True}


@router.get("/{friend_id}/tasks", response_model=list[TaskOut])
def get_friend_tasks(friend_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not _are_friends(db, current_user.id, friend_id):
        raise HTTPException(status_code=403, detail="친구가 아닙니다")
    selective_ids = db.query(TaskVisibilityFriend.task_id).filter(
        TaskVisibilityFriend.friend_user_id == current_user.id
    ).subquery()
    tasks = db.query(Task).filter(
        Task.user_id == friend_id,
        or_(
            Task.visibility == "public",
            and_(Task.visibility == "selective", Task.id.in_(selective_ids)),
        ),
    ).order_by(Task.start_at.asc()).all()
    return tasks
