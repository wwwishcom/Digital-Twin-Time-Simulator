"""
LogEntry → DailyAggregate 계산 서비스
날짜 × 타입 단위로 집계하고 캐시 테이블에 저장한다.
"""
import json
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.log_entry import LogEntry
from app.models.daily_aggregate import DailyAggregate


def build_daily_aggregates(db: Session, user_id: int, target_date: date) -> list[DailyAggregate]:
    """
    해당 날짜의 모든 LogEntry를 타입별로 집계하여 DailyAggregate를 upsert 한다.
    반환값: 해당 날짜의 DailyAggregate 목록
    """
    entries = (
        db.query(LogEntry)
        .filter(
            LogEntry.user_id == user_id,
            func.date(LogEntry.timestamp) == target_date,
        )
        .all()
    )

    # 타입별 분류
    by_type: dict[str, list[LogEntry]] = {}
    for e in entries:
        by_type.setdefault(e.type, []).append(e)

    results = []
    for log_type, type_entries in by_type.items():
        values = [e.value for e in type_entries]
        total = sum(values)
        average = total / len(values) if values else 0.0
        count = len(values)
        meta_summary = _build_meta_summary(log_type, type_entries)

        # 기존 집계가 있으면 update, 없으면 insert
        agg = (
            db.query(DailyAggregate)
            .filter(
                DailyAggregate.user_id == user_id,
                DailyAggregate.date == target_date,
                DailyAggregate.type == log_type,
            )
            .first()
        )
        if agg is None:
            agg = DailyAggregate(
                user_id=user_id,
                date=target_date,
                type=log_type,
            )
            db.add(agg)

        agg.total = total
        agg.average = average
        agg.count = count
        agg.meta_summary = json.dumps(meta_summary, ensure_ascii=False)
        results.append(agg)

    db.commit()
    for agg in results:
        db.refresh(agg)
    return results


def _build_meta_summary(log_type: str, entries: list[LogEntry]) -> dict:
    """타입별 추가 집계 메타 생성"""
    metas = []
    for e in entries:
        try:
            metas.append(json.loads(e.meta) if e.meta else {})
        except (json.JSONDecodeError, TypeError):
            metas.append({})

    if log_type == "sleep":
        qualities = [m.get("quality") for m in metas if m.get("quality") is not None]
        return {
            "avg_quality": sum(qualities) / len(qualities) if qualities else None,
        }

    if log_type == "study":
        concentrations = [m.get("concentration") for m in metas if m.get("concentration") is not None]
        subjects = list({m.get("subject") for m in metas if m.get("subject")})
        return {
            "concentration_avg": sum(concentrations) / len(concentrations) if concentrations else None,
            "subjects": subjects,
        }

    if log_type == "health":
        exercise_types = [m.get("exercise_type") for m in metas if m.get("exercise_type")]
        duration_mins = [m.get("duration_min") for m in metas if m.get("duration_min") is not None]
        has_exercise = any(
            m.get("has_exercise", False) or m.get("exercise_type") for m in metas
        ) or len(entries) > 0
        return {
            "has_exercise": has_exercise,
            "total_duration_min": sum(duration_mins) if duration_mins else None,
            "exercise_types": exercise_types,
        }

    if log_type == "spend":
        impulse_flags = [m.get("is_impulse", False) for m in metas]
        total_entries = len(impulse_flags)
        impulse_count = sum(1 for f in impulse_flags if f)
        impulse_ratio = impulse_count / total_entries if total_entries else 0.0
        savings_ratio = 1.0 - impulse_ratio
        categories = {}
        for m in metas:
            cat = m.get("category", "기타")
            categories[cat] = categories.get(cat, 0) + 1
        return {
            "impulse_ratio": impulse_ratio,
            "savings_ratio": savings_ratio,
            "categories": categories,
        }

    if log_type == "mood":
        emotion_types = [m.get("emotion_type") for m in metas if m.get("emotion_type")]
        counts: dict = {}
        for e_type in emotion_types:
            counts[e_type] = counts.get(e_type, 0) + 1
        return {"emotion_counts": counts}

    return {}


def get_aggregates_range(
    db: Session,
    user_id: int,
    date_from: date,
    date_to: date,
) -> list[DailyAggregate]:
    return (
        db.query(DailyAggregate)
        .filter(
            DailyAggregate.user_id == user_id,
            DailyAggregate.date >= date_from,
            DailyAggregate.date <= date_to,
        )
        .order_by(DailyAggregate.date.asc())
        .all()
    )
