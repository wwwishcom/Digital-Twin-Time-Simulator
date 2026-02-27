from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class ScheduleDraft(Base):
    """Twin Lab → 캘린더 초안 (편집 후 Task로 적용)"""
    __tablename__ = "schedule_drafts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    plan_name = Column(String(100), nullable=False)

    # JSON list of event objects:
    # [{"title": str, "category": str, "start_at": ISO8601, "end_at": ISO8601,
    #   "note": str, "status": "planned"}]
    events = Column(Text, nullable=False, default="[]")

    # draft → applied
    status = Column(String(10), nullable=False, default="draft")

    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="schedule_drafts")
