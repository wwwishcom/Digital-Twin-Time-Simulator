from sqlalchemy import Column, Integer, Float, Date, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class LifeScore(Base):
    """날짜별 4가지 핵심 스코어 (0~100)"""
    __tablename__ = "life_scores"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)

    energy = Column(Float, default=0.0)          # 에너지/체력 (수면+운동 기반)
    mental = Column(Float, default=0.0)          # 멘탈 안정도 (감정+소비 패턴)
    focus = Column(Float, default=0.0)           # 집중/생산성 (공부시간+집중도)
    goal_progress = Column(Float, default=0.0)   # 목표 진행률 (종합)

    computed_at = Column(DateTime, default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_life_score"),
    )

    user = relationship("User", back_populates="life_scores")
