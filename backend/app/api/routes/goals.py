from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.goal import Goal
from app.models.user import User
from app.schemas.goal import GoalCreate, GoalBulkCreate, GoalOut

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[GoalOut])
def list_goals(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Goal).filter(Goal.user_id == current_user.id).order_by(Goal.created_at.asc()).all()


@router.post("", response_model=GoalOut)
def create_goal(payload: GoalCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = Goal(user_id=current_user.id, text=payload.text, type=payload.type)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.post("/bulk", response_model=list[GoalOut])
def bulk_create_goals(payload: GoalBulkCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goals = [Goal(user_id=current_user.id, text=g.text, type=g.type) for g in payload.goals]
    db.add_all(goals)
    db.commit()
    for g in goals:
        db.refresh(g)
    return goals


@router.delete("/{goal_id}")
def delete_goal(goal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == current_user.id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(goal)
    db.commit()
    return {"deleted": True}
