"""
Twinny 요약/추천 서비스 (규칙 기반 MVP)

인터페이스 분리 원칙:
  입력  : TwinnyInput (recent_aggregates, today_scores, context)
  출력  : TwinnySummaryResult (summaryText, riskLevel, recommendations, evidence, triggers)

나중에 LLM으로 교체할 때는 generate_summary() 함수 내부만 바꾸면 된다.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.daily_aggregate import DailyAggregate
from app.models.life_score import LifeScore
from app.schemas.life_score import TwinnySummaryOut
from app.services.score_service import compute_life_score, get_score_range


# ─── 트리거 이름 상수 ─────────────────────────────────────────────────────────
LOW_SLEEP_3D = "LOW_SLEEP_3D"
HIGH_FOCUS = "HIGH_FOCUS"
IMPULSE_SPENDING = "IMPULSE_SPENDING"
BURNOUT_RISK = "BURNOUT_RISK"
IMPROVING_MOOD = "IMPROVING_MOOD"
EXERCISE_MISSING = "EXERCISE_MISSING"
LOW_ENERGY = "LOW_ENERGY"
LOW_MENTAL = "LOW_MENTAL"
GREAT_BALANCE = "GREAT_BALANCE"


@dataclass
class TwinnyInput:
    today_scores: LifeScore
    aggregates: list[DailyAggregate]       # window 기간의 집계 목록
    recent_scores: list[LifeScore]         # window 기간의 스코어 목록


@dataclass
class TwinnySummaryResult:
    summary_text: str
    risk_level: str                        # 낮음 / 중간 / 높음
    recommendations: list[str] = field(default_factory=list)
    evidence: list[str] = field(default_factory=list)
    triggers: list[str] = field(default_factory=list)


# ─── 트리거 감지 ──────────────────────────────────────────────────────────────

def detect_triggers(inp: TwinnyInput) -> list[str]:
    triggers = []
    aggs = inp.aggregates
    scores = inp.recent_scores
    today = inp.today_scores

    # 타입별 최근 N일 집계 helper
    def by_type(t: str) -> list[DailyAggregate]:
        return [a for a in aggs if a.type == t]

    def meta_of(agg: DailyAggregate) -> dict:
        try:
            return json.loads(agg.meta_summary) if agg.meta_summary else {}
        except (json.JSONDecodeError, TypeError):
            return {}

    sleep_aggs = by_type("sleep")
    health_aggs = by_type("health")
    spend_aggs = by_type("spend")
    mood_aggs = by_type("mood")
    study_aggs = by_type("study")

    # LOW_SLEEP_3D: 최근 3일 수면 평균 < 6h
    recent_sleep = sorted(sleep_aggs, key=lambda a: a.date, reverse=True)[:3]
    if len(recent_sleep) >= 2:
        avg_sleep = sum(a.average for a in recent_sleep) / len(recent_sleep)
        if avg_sleep < 6.0:
            triggers.append(LOW_SLEEP_3D)

    # HIGH_FOCUS: 공부 집중도 평균 > 4.0
    concentrations = [
        meta_of(a).get("concentration_avg")
        for a in study_aggs
        if meta_of(a).get("concentration_avg") is not None
    ]
    if concentrations and (sum(concentrations) / len(concentrations)) > 4.0:
        triggers.append(HIGH_FOCUS)

    # IMPULSE_SPENDING: impulse_ratio > 0.5 (평균 50% 이상이 충동 소비)
    impulse_ratios = [
        meta_of(a).get("impulse_ratio", 0)
        for a in spend_aggs
    ]
    if impulse_ratios:
        avg_impulse = sum(impulse_ratios) / len(impulse_ratios)
        if avg_impulse > 0.5:
            triggers.append(IMPULSE_SPENDING)

    # BURNOUT_RISK: 에너지 < 35 AND 집중 > 65
    if today.energy < 35 and today.focus > 65:
        triggers.append(BURNOUT_RISK)

    # IMPROVING_MOOD: 감정점수 3일 연속 상승
    recent_mood = sorted(mood_aggs, key=lambda a: a.date)[-3:]
    if len(recent_mood) == 3:
        if recent_mood[0].average < recent_mood[1].average < recent_mood[2].average:
            triggers.append(IMPROVING_MOOD)

    # EXERCISE_MISSING: 최근 5일 이상 운동 없음
    recent_health = sorted(health_aggs, key=lambda a: a.date, reverse=True)[:5]
    if len(recent_health) == 0 or not any(meta_of(a).get("has_exercise") for a in recent_health):
        triggers.append(EXERCISE_MISSING)

    # LOW_ENERGY
    if today.energy < 30:
        triggers.append(LOW_ENERGY)

    # LOW_MENTAL
    if today.mental < 30:
        triggers.append(LOW_MENTAL)

    # GREAT_BALANCE: 모든 스코어 60 이상
    if all(s >= 60 for s in [today.energy, today.mental, today.focus, today.goal_progress]):
        triggers.append(GREAT_BALANCE)

    return triggers


# ─── 템플릿 선택 ──────────────────────────────────────────────────────────────

_TEMPLATES: dict[str, dict] = {
    LOW_SLEEP_3D: {
        "risk": "중간",
        "summary": "최근 며칠간 수면이 부족해서 에너지가 떨어지고 있어. 지금 몸이 쉬고 싶다는 신호를 보내고 있어.",
        "recommendations": [
            "오늘 취침 시간을 30분 앞당겨봐요",
            "취침 전 1시간은 화면을 멀리하면 수면 질이 올라가요",
        ],
    },
    BURNOUT_RISK: {
        "risk": "높음",
        "summary": "에너지는 낮은데 집중은 유지하고 있어. 지금 너무 무리하고 있어서 번아웃이 올 수도 있어.",
        "recommendations": [
            "오늘은 25분 × 4세트로 짧게 끊고 중간중간 꼭 쉬어요",
            "오늘 저녁은 가벼운 산책이나 스트레칭만 해요",
        ],
    },
    EXERCISE_MISSING: {
        "risk": "중간",
        "summary": "최근 운동을 못 하고 있네. 몸을 조금씩 움직여주면 에너지도 올라가고 기분도 좋아질 거야.",
        "recommendations": [
            "오늘 15분이라도 걷거나 스트레칭을 해봐요",
            "이번 주 안에 운동 일정을 캘린더에 잡아봐요",
        ],
    },
    IMPULSE_SPENDING: {
        "risk": "중간",
        "summary": "최근 계획 없는 지출이 늘고 있어. 소비 패턴을 돌아보면 멘탈 안정에도 도움이 돼.",
        "recommendations": [
            "구매 전 24시간 대기 규칙을 적용해봐요",
            "이번 주 일일 소비 한도를 정해봐요",
        ],
    },
    HIGH_FOCUS: {
        "risk": "낮음",
        "summary": "공부 집중도가 좋은 흐름이야! 이 페이스를 유지하면서 수면도 챙기면 더 오래 유지될 거야.",
        "recommendations": [
            "집중 시간대(오전/오후)를 파악해서 중요한 공부를 그때 해봐요",
            "충분한 수면으로 집중력을 계속 유지해요",
        ],
    },
    IMPROVING_MOOD: {
        "risk": "낮음",
        "summary": "감정 상태가 좋아지고 있어! 최근 3일 동안 기분이 계속 좋아지고 있네.",
        "recommendations": [
            "지금 기분 좋게 만드는 루틴을 기록해두면 나중에 도움이 돼요",
            "이 흐름을 타서 새로운 습관을 시작해봐요",
        ],
    },
    LOW_ENERGY: {
        "risk": "높음",
        "summary": "오늘 에너지 수치가 많이 낮아. 수면, 운동, 식습관을 점검해봐야 할 것 같아.",
        "recommendations": [
            "오늘은 무리하지 말고 가장 중요한 것 하나에만 집중해요",
            "물을 충분히 마시고 가벼운 스트레칭을 해봐요",
        ],
    },
    LOW_MENTAL: {
        "risk": "높음",
        "summary": "멘탈 지수가 낮아. 스트레스나 감정 기복이 있을 수 있어. 지금 자신을 좀 더 돌봐줘.",
        "recommendations": [
            "오늘은 나를 위한 시간을 조금 가져봐요",
            "감정을 일기에 써보면 마음이 정리될 수 있어요",
        ],
    },
    GREAT_BALANCE: {
        "risk": "낮음",
        "summary": "에너지, 멘탈, 집중, 목표 모두 균형 잡혀 있어! 지금 컨디션이 정말 좋아.",
        "recommendations": [
            "이 루틴을 유지해요. 무너지지 않는 게 가장 중요해요",
            "새로운 목표를 하나 추가해볼 타이밍이에요",
        ],
    },
}

_DEFAULT_TEMPLATE = {
    "risk": "낮음",
    "summary": "오늘도 하루를 잘 보내고 있어! 꾸준히 기록하면 더 정확한 분석이 가능해져.",
    "recommendations": [
        "오늘의 기록을 잊지 말고 남겨봐요",
        "작은 습관이 쌓이면 큰 변화가 생겨요",
    ],
}


def _build_evidence(triggers: list[str], inp: TwinnyInput) -> list[str]:
    """트리거별 구체적인 수치 근거 생성"""
    evidence = []
    aggs = inp.aggregates
    today = inp.today_scores

    def by_type(t: str) -> list[DailyAggregate]:
        return sorted([a for a in aggs if a.type == t], key=lambda a: a.date, reverse=True)

    def meta_of(agg: DailyAggregate) -> dict:
        try:
            return json.loads(agg.meta_summary) if agg.meta_summary else {}
        except (json.JSONDecodeError, TypeError):
            return {}

    if LOW_SLEEP_3D in triggers:
        recent = by_type("sleep")[:3]
        if recent:
            avg = sum(a.average for a in recent) / len(recent)
            evidence.append(f"수면 평균 {avg:.1f}시간 (최근 {len(recent)}일 기준)")

    if BURNOUT_RISK in triggers:
        evidence.append(f"에너지 {today.energy:.0f} / 집중 {today.focus:.0f} — 체력 대비 집중 과부하")

    if EXERCISE_MISSING in triggers:
        evidence.append("최근 5일간 운동 기록 없음")

    if IMPULSE_SPENDING in triggers:
        recent = by_type("spend")
        ratios = [meta_of(a).get("impulse_ratio", 0) for a in recent]
        if ratios:
            avg_r = sum(ratios) / len(ratios)
            evidence.append(f"충동 소비 비율 {avg_r*100:.0f}% (최근 {len(ratios)}일)")

    if HIGH_FOCUS in triggers:
        recent = by_type("study")
        concs = [meta_of(a).get("concentration_avg") for a in recent if meta_of(a).get("concentration_avg")]
        if concs:
            avg_c = sum(concs) / len(concs)
            evidence.append(f"공부 집중도 평균 {avg_c:.1f} / 5.0")

    if IMPROVING_MOOD in triggers:
        recent = by_type("mood")[:3]
        if len(recent) >= 2:
            scores_str = " → ".join(f"{a.average:.1f}" for a in reversed(recent))
            evidence.append(f"감정 점수 추세: {scores_str} (상승 중)")

    if LOW_ENERGY in triggers:
        evidence.append(f"에너지 스코어 {today.energy:.0f} / 100")

    if LOW_MENTAL in triggers:
        evidence.append(f"멘탈 스코어 {today.mental:.0f} / 100")

    if GREAT_BALANCE in triggers:
        evidence.append(
            f"전체 균형: 에너지 {today.energy:.0f} / 멘탈 {today.mental:.0f} / "
            f"집중 {today.focus:.0f} / 목표 {today.goal_progress:.0f}"
        )

    return evidence


# ─── 메인 인터페이스 ──────────────────────────────────────────────────────────

def generate_summary(inp: TwinnyInput) -> TwinnySummaryResult:
    """
    규칙 기반 Twinny 요약 생성.
    나중에 LLM으로 교체할 때는 이 함수만 교체하면 된다.
    """
    triggers = detect_triggers(inp)
    evidence = _build_evidence(triggers, inp)

    # 우선순위: 높음 위험 트리거 먼저
    priority_order = [BURNOUT_RISK, LOW_ENERGY, LOW_MENTAL, LOW_SLEEP_3D, EXERCISE_MISSING,
                      IMPULSE_SPENDING, GREAT_BALANCE, HIGH_FOCUS, IMPROVING_MOOD]
    selected_trigger = None
    for t in priority_order:
        if t in triggers:
            selected_trigger = t
            break

    template = _TEMPLATES.get(selected_trigger, _DEFAULT_TEMPLATE) if selected_trigger else _DEFAULT_TEMPLATE

    return TwinnySummaryResult(
        summary_text=template["summary"],
        risk_level=template["risk"],
        recommendations=template["recommendations"],
        evidence=evidence,
        triggers=triggers,
    )


def get_twinny_summary(db: Session, user_id: int, target_date: date) -> TwinnySummaryOut:
    """
    DB에서 데이터를 조회하여 Twinny 요약을 생성한다.
    """
    from app.services.aggregate_service import get_aggregates_range

    window = 7
    date_from = target_date - timedelta(days=window - 1)

    # 오늘 스코어 계산 (없으면 compute)
    today_score = (
        db.query(LifeScore)
        .filter(LifeScore.user_id == user_id, LifeScore.date == target_date)
        .first()
    )
    if today_score is None:
        today_score = compute_life_score(db, user_id, target_date)

    aggregates = get_aggregates_range(db, user_id, date_from, target_date)
    recent_scores = (
        db.query(LifeScore)
        .filter(
            LifeScore.user_id == user_id,
            LifeScore.date >= date_from,
            LifeScore.date <= target_date,
        )
        .order_by(LifeScore.date.asc())
        .all()
    )

    inp = TwinnyInput(
        today_scores=today_score,
        aggregates=aggregates,
        recent_scores=recent_scores,
    )
    result = generate_summary(inp)

    return TwinnySummaryOut(
        summary_text=result.summary_text,
        risk_level=result.risk_level,
        recommendations=result.recommendations,
        evidence=result.evidence,
        triggers=result.triggers,
        date=str(target_date),
    )
