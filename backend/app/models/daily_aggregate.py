from sqlalchemy import Column, Integer, String, Float, Date, Text, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class DailyAggregate(Base):
    """날짜 × 타입 단위 집계 캐시 (LogEntry → 집계)"""
    __tablename__ = "daily_aggregates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)

    # health / study / spend / sleep / mood
    type = Column(String(20), nullable=False)

    total = Column(Float, default=0.0)   # 합계
    average = Column(Float, default=0.0) # 평균
    count = Column(Integer, default=0)   # 기록 건수

    # 타입별 추가 집계 (JSON)
    # sleep  → {"avg_quality": float}
    # study  → {"concentration_avg": float, "subjects": [...]}
    # health → {"has_exercise": bool, "total_duration_min": int, "exercise_types": [...]}
    # spend  → {"impulse_ratio": float, "categories": {...}}
    # mood   → {"emotion_counts": {...}}
    meta_summary = Column(Text, nullable=True)

    computed_at = Column(DateTime, default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "date", "type", name="uq_daily_aggregate"),
    )

    user = relationship("User", back_populates="daily_aggregates")
