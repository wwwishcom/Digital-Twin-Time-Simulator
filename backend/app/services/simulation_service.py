"""
Twin Lab What-If 시뮬레이션 서비스

베이스라인(최근 7일 평균 스코어) + 변수 변화량 × 계수 → 예상 스코어
"""
from datetime import date
from sqlalchemy.orm import Session

from app.schemas.life_score import ScoreSnapshot, WhatIfRequest, WhatIfResult
from app.services.score_service import get_baseline_snapshot
from app.services.simulation_config import SIM_COEFFICIENTS, SIM_SIDE_EFFECTS, HORIZON_MULTIPLIER


def run_what_if(
    db: Session,
    user_id: int,
    request: WhatIfRequest,
) -> WhatIfResult:
    today = date.today()
    baseline = get_baseline_snapshot(db, user_id, today, window=7)

    changes = request.changes
    horizon = request.horizon_days
    multiplier = HORIZON_MULTIPLIER.get(horizon, 1.0)

    delta = {"energy": 0.0, "mental": 0.0, "focus": 0.0, "goal_progress": 0.0}
    warnings = []

    # ─── 기본 계수 적용 ────────────────────────────────────────────────────
    for var_name, change_value in changes.items():
        if var_name not in SIM_COEFFICIENTS:
            continue
        coeff = SIM_COEFFICIENTS[var_name]
        for score_key, coeff_val in coeff.items():
            delta[score_key] += coeff_val * change_value

    # ─── 상충 효과 적용 ────────────────────────────────────────────────────
    for side_effect in SIM_SIDE_EFFECTS:
        var_name = side_effect["variable"]
        threshold = side_effect["threshold"]
        change_value = changes.get(var_name, 0)
        if change_value > threshold:
            extra = side_effect["above_threshold_extra"]
            for score_key, extra_val in extra.items():
                delta[score_key] += extra_val
            # 경고 메시지 생성
            if var_name == "study_hours":
                warnings.append(
                    f"공부 시간을 {change_value:.1f}시간 늘리면 집중은 오르지만 피로와 스트레스가 함께 증가할 수 있어요."
                )
            elif var_name == "sleep_hours":
                warnings.append(
                    f"수면을 {change_value:.1f}시간 늘리면 수면 부채가 빠르게 회복돼 목표 달성에 더 유리해요."
                )

    # ─── horizon 감쇠 적용 ────────────────────────────────────────────────
    delta = {k: v * multiplier for k, v in delta.items()}

    # ─── 예상 스코어 계산 (0~100 클램프) ─────────────────────────────────
    def clamp(v: float) -> float:
        return round(max(0.0, min(100.0, v)), 1)

    projected = ScoreSnapshot(
        energy=clamp(baseline.energy + delta["energy"]),
        mental=clamp(baseline.mental + delta["mental"]),
        focus=clamp(baseline.focus + delta["focus"]),
        goal_progress=clamp(baseline.goal_progress + delta["goal_progress"]),
    )

    delta_snapshot = ScoreSnapshot(
        energy=round(delta["energy"], 1),
        mental=round(delta["mental"], 1),
        focus=round(delta["focus"], 1),
        goal_progress=round(delta["goal_progress"], 1),
    )

    twinny_comment = _generate_lab_comment(changes, delta, warnings)

    return WhatIfResult(
        baseline=baseline,
        projected=projected,
        delta=delta_snapshot,
        twinny_comment=twinny_comment,
        warnings=warnings,
    )


def _generate_lab_comment(changes: dict, delta: dict, warnings: list[str]) -> str:
    """Twin Lab용 짧은 Twinny 코멘트 (1~2문장)"""
    positive = [(k, v) for k, v in delta.items() if v >= 5]
    negative = [(k, v) for k, v in delta.items() if v <= -5]

    score_names = {
        "energy": "에너지",
        "mental": "멘탈",
        "focus": "집중력",
        "goal_progress": "목표 진행률",
    }

    parts = []
    if positive:
        top_pos = sorted(positive, key=lambda x: x[1], reverse=True)[:2]
        pos_str = ", ".join(score_names[k] for k, _ in top_pos)
        parts.append(f"{pos_str}이 크게 좋아질 거야")

    if negative:
        top_neg = sorted(negative, key=lambda x: x[1])[:1]
        neg_str = ", ".join(score_names[k] for k, _ in top_neg)
        parts.append(f"대신 {neg_str}이 약간 떨어질 수 있어")

    if not parts:
        return "이 실험안은 전반적으로 균형 잡힌 변화를 가져올 것 같아."

    comment = ". ".join(parts) + "."

    # 균형 개선 제안
    if "energy" in dict(negative) and changes.get("study_hours", 0) > 2:
        comment += " 수면도 함께 늘리면 에너지를 유지하면서 더 좋은 결과를 낼 수 있어."
    elif "mental" in dict(negative) and changes.get("spend_reduction_10pct", 0) == 0:
        comment += " 소비 습관도 조금 조정하면 멘탈 안정에 도움이 돼."

    return comment
