"""
DailyAggregate → LifeScore 계산 서비스
SCORE_CONFIG 기반으로 4가지 스코어(에너지/멘탈/집중/목표)를 0~100 범위로 산출한다.
"""
import json
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.models.daily_aggregate import DailyAggregate
from app.models.life_score import LifeScore
from app.schemas.life_score import ScoreSnapshot
from app.services.score_config import SCORE_CONFIG
from app.services.aggregate_service import build_daily_aggregates


def compute_life_score(db: Session, user_id: int, target_date: date) -> LifeScore:
    """
    target_date 기준으로 4가지 스코어를 계산하고 LifeScore 테이블에 upsert 한다.
    - 먼저 target_date의 집계를 재계산한다.
    - 각 스코어 구성 요소는 window_days 기간의 이동평균으로 계산한다.
    """
    # 당일 집계 재계산
    build_daily_aggregates(db, user_id, target_date)

    scores = {}
    for score_name, config in SCORE_CONFIG.items():
        scores[score_name] = _compute_score(db, user_id, target_date, config)

    # upsert
    ls = (
        db.query(LifeScore)
        .filter(LifeScore.user_id == user_id, LifeScore.date == target_date)
        .first()
    )
    if ls is None:
        ls = LifeScore(user_id=user_id, date=target_date)
        db.add(ls)

    ls.energy = scores["energy"]
    ls.mental = scores["mental"]
    ls.focus = scores["focus"]
    ls.goal_progress = scores["goal_progress"]
    db.commit()
    db.refresh(ls)
    return ls


def _compute_score(db: Session, user_id: int, target_date: date, config: dict) -> float:
    """단일 스코어 계산 (이동평균 적용)"""
    window = config["window_days"]
    date_from = target_date - timedelta(days=window - 1)

    # 창 내 aggregates 조회
    aggs = (
        db.query(DailyAggregate)
        .filter(
            DailyAggregate.user_id == user_id,
            DailyAggregate.date >= date_from,
            DailyAggregate.date <= target_date,
        )
        .all()
    )

    # date × type 인덱스
    agg_map: dict[tuple, DailyAggregate] = {(a.date, a.type): a for a in aggs}

    raw_total = 0.0
    weight_sum = 0.0

    for comp in config["components"]:
        comp_type = comp["type"]
        weight = comp["weight"]

        # 창 내 각 날짜 값 수집
        day_values = []
        for delta in range(window):
            d = date_from + timedelta(days=delta)
            agg = agg_map.get((d, comp_type))
            if agg is None:
                continue
            val = _extract_component_value(agg, comp)
            if val is not None:
                day_values.append(val)

        if not day_values:
            # 데이터 없음 → 해당 컴포넌트는 중립값(0.5)으로 처리
            normalized = 0.5
        else:
            avg_val = sum(day_values) / len(day_values)
            scale_max = comp.get("scale_max", 1.0)
            is_boolean = comp.get("is_boolean", False)
            if is_boolean:
                normalized = avg_val  # 이미 0/1 평균
            else:
                normalized = min(avg_val / scale_max, 1.0)

        raw_total += weight * normalized
        weight_sum += abs(weight)

    if weight_sum == 0:
        return 50.0

    # 정규화: weight 합이 1이 되도록 정규화 후 100 스케일
    normalized_score = (raw_total / weight_sum + 1.0) / 2.0  # -1~1 → 0~1
    # 가중합 방식으로 재조정 (음수 weight 존재 가능)
    score = _weighted_sum_to_score(config["components"], db, user_id, target_date, window, date_from, agg_map)
    return round(max(0.0, min(100.0, score)), 1)


def _weighted_sum_to_score(
    components: list,
    db: Session,
    user_id: int,
    target_date: date,
    window: int,
    date_from: date,
    agg_map: dict,
) -> float:
    """양수 가중치 합산으로 0~100 스코어 계산"""
    positive_sum = 0.0
    negative_sum = 0.0

    for comp in components:
        comp_type = comp["type"]
        weight = comp["weight"]

        day_values = []
        for delta in range(window):
            d = date_from + timedelta(days=delta)
            agg = agg_map.get((d, comp_type))
            if agg is None:
                continue
            val = _extract_component_value(agg, comp)
            if val is not None:
                day_values.append(val)

        if not day_values:
            normalized = 0.3  # 데이터 없을 때 낮은 기본값
        else:
            avg_val = sum(day_values) / len(day_values)
            scale_max = comp.get("scale_max", 1.0)
            is_boolean = comp.get("is_boolean", False)
            if is_boolean:
                normalized = avg_val
            else:
                normalized = min(avg_val / scale_max, 1.0)

        if weight >= 0:
            positive_sum += weight * normalized
        else:
            negative_sum += abs(weight) * normalized

    # 양수 기여 - 음수 기여 → 0~1
    total_positive_weight = sum(abs(c["weight"]) for c in components if c["weight"] >= 0)
    total_negative_weight = sum(abs(c["weight"]) for c in components if c["weight"] < 0)

    pos_score = positive_sum / total_positive_weight if total_positive_weight > 0 else 0.5
    neg_penalty = negative_sum / total_negative_weight if total_negative_weight > 0 else 0.0

    # 양수 가중치 비율
    pos_weight_ratio = total_positive_weight / (total_positive_weight + total_negative_weight) if (total_positive_weight + total_negative_weight) > 0 else 1.0

    score = (pos_score * pos_weight_ratio - neg_penalty * (1 - pos_weight_ratio)) * 100
    return score


def _extract_component_value(agg: DailyAggregate, comp: dict) -> float | None:
    """DailyAggregate 에서 컴포넌트 값 추출"""
    meta_key = comp.get("meta_key")
    field = comp.get("field")

    if meta_key:
        try:
            meta = json.loads(agg.meta_summary) if agg.meta_summary else {}
        except (json.JSONDecodeError, TypeError):
            meta = {}
        val = meta.get(meta_key)
        if val is None:
            return None
        if comp.get("is_boolean"):
            return 1.0 if val else 0.0
        return float(val)
    elif field:
        return getattr(agg, field, None)
    return None


def get_score_range(
    db: Session,
    user_id: int,
    date_from: date,
    date_to: date,
) -> list[LifeScore]:
    return (
        db.query(LifeScore)
        .filter(
            LifeScore.user_id == user_id,
            LifeScore.date >= date_from,
            LifeScore.date <= date_to,
        )
        .order_by(LifeScore.date.asc())
        .all()
    )


def get_baseline_snapshot(db: Session, user_id: int, as_of: date, window: int = 7) -> ScoreSnapshot:
    """최근 window일의 평균 스코어를 베이스라인으로 반환"""
    date_from = as_of - timedelta(days=window - 1)
    scores = get_score_range(db, user_id, date_from, as_of)

    if not scores:
        return ScoreSnapshot(energy=50.0, mental=50.0, focus=50.0, goal_progress=50.0)

    return ScoreSnapshot(
        energy=round(sum(s.energy for s in scores) / len(scores), 1),
        mental=round(sum(s.mental for s in scores) / len(scores), 1),
        focus=round(sum(s.focus for s in scores) / len(scores), 1),
        goal_progress=round(sum(s.goal_progress for s in scores) / len(scores), 1),
    )
