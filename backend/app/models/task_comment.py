from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class TaskComment(Base):
    """일정 댓글 — 일정 소유자와 참여자(shared copy) 간 소통"""
    __tablename__ = "task_comments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(String(1000), nullable=False)
    parent_id = Column(Integer, ForeignKey("task_comments.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User")
