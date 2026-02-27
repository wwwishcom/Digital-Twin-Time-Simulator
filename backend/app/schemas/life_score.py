from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class LifeScoreOut(BaseModel):
    id: int
    user_id: int
    date: date
    energy: float
    mental: float
    focus: float
    goal_progress: float
    computed_at: datetime

    model_config = {"from_attributes": True}


class ScoreSnapshot(BaseModel):
    """시뮬레이션/비교용 스냅샷 (DB 모델 없음)"""
    energy: float
    mental: float
    focus: float
    goal_progress: float


class TwinnySummaryOut(BaseModel):
    summary_text: str
    risk_level: str                  # 낮음 / 중간 / 높음
    recommendations: list[str]
    evidence: list[str]              # Explain 토글 근거 bullet
    triggers: list[str]              # 감지된 트리거명

    date: Optional[str] = None


class WhatIfRequest(BaseModel):
    changes: dict                    # {"sleep_hours": 1.5, "study_hours": 1.0, ...}
    horizon_days: int = 7            # 7 or 30


class WhatIfResult(BaseModel):
    baseline: ScoreSnapshot
    projected: ScoreSnapshot
    delta: ScoreSnapshot
    twinny_comment: str
    warnings: list[str]
