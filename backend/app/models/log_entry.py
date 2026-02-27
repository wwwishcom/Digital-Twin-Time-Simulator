from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class LogEntry(Base):
    """원시 기록 로그 — 수면/공부/운동/소비/감정 등 모든 기록의 공통 포맷"""
    __tablename__ = "log_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # health / study / spend / sleep / mood
    type = Column(String(20), nullable=False, index=True)

    # 기록 시각 (사용자가 지정하거나 기본값은 현재 시각)
    timestamp = Column(DateTime, nullable=False, default=func.now())

    # 수치값: 수면=시간(float), 공부=시간(float), 감정=1~5, 소비=금액, 운동=세션수
    value = Column(Float, nullable=False)

    # 추가 메타데이터 (JSON 문자열)
    # sleep  → {"quality": 1-5}
    # study  → {"concentration": 1-5, "subject": str}
    # health → {"exercise_type": str, "duration_min": int, "has_exercise": true}
    # spend  → {"category": str, "is_impulse": bool}
    # mood   → {"emotion_type": str}
    meta = Column(Text, nullable=True)

    note = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="log_entries")
