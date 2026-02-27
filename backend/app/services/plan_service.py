"""
Twin Lab → 캘린더 초안 자동 생성 서비스

시뮬레이션 변수 변화량을 받아 실행 가능한 일정 이벤트를 생성한다.
생성된 이벤트 목록은 ScheduleDraft에 저장되고, 사용자가 편집 후 Task로 적용한다.
"""
import json
from datetime import date, datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from app.models.schedule_draft import ScheduleDraft
from app.schemas.schedule_draft import ScheduleDraftCreate, ScheduleDraftEvent, ScheduleDraftOut


# 요일 인덱스 0=월 ~ 6=일
_WEEKDAY_DEFAULT_EXERCISE = [0, 2, 4]  # 월/수/금


def generate_draft(
    db: Session,
    user_id: int,
    plan_name: str,
    changes: dict,
    horizon_days: int = 7,
    preferences: Optional[dict] = None,
) -> ScheduleDraft:
    """
    changes 에 따라 일정 이벤트 목록을 생성하고 ScheduleDraft를 DB에 저장한다.

    preferences (optional):
      sleep_target_hour  : 취침 목표 시각 (0~23, 기본 23)
      wake_target_hour   : 기상 목표 시각 (0~23, 기본 6)
      study_format       : 'pomodoro' | 'block' (기본 'pomodoro')
      exercise_days      : ['MON','WED','FRI'] 형태 (없으면 기본값)
    """
    prefs = preferences or {}
    today = date.today()
    events: list[dict] = []

    sleep_delta = changes.get("sleep_hours", 0)
    study_delta = changes.get("study_hours", 0)
    exercise_delta = changes.get("exercise_per_week", 0)
    spend_reduction = changes.get("spend_reduction_10pct", 0)
    phone_reduction = changes.get("phone_minus_30min", 0)

    # ─── 수면 목표 이벤트 (매일) ─────────────────────────────────────────────
    if abs(sleep_delta) >= 0.5:
        sleep_hour = int(prefs.get("sleep_target_hour", 23))
        wake_hour = int(prefs.get("wake_target_hour", 6))
        # 목표 수면 시간 반영
        target_sleep = 7.0 + sleep_delta
        actual_duration = max(5.0, min(10.0, target_sleep))
        for day_offset in range(min(horizon_days, 14)):  # 최대 2주
            d = today + timedelta(days=day_offset + 1)
            bedtime = datetime(d.year, d.month, d.day, sleep_hour, 0)
            # 기상 시각 = 취침 + 목표 수면 시간
            wake_dt = bedtime + timedelta(hours=actual_duration)
            events.append({
                "title": f"취침 목표 ({sleep_hour}시) — 수면 {actual_duration:.1f}h 목표",
                "category": "health",
                "start_at": bedtime.isoformat(),
                "end_at": wake_dt.isoformat(),
                "note": f"Twin Lab 플랜: 수면 {sleep_delta:+.1f}h",
                "status": "planned",
            })

    # ─── 공부 블록 (매일) ────────────────────────────────────────────────────
    if study_delta > 0:
        study_format = prefs.get("study_format", "pomodoro")
        target_hours = max(1.0, study_delta)
        for day_offset in range(min(horizon_days, 14)):
            d = today + timedelta(days=day_offset + 1)
            if study_format == "pomodoro":
                sets = max(1, round(target_hours / 0.5))  # 25분 × N세트
                block_start = datetime(d.year, d.month, d.day, 9, 0)
                for s in range(sets):
                    s_start = block_start + timedelta(minutes=s * 35)  # 25분 공부 + 10분 휴식
                    s_end = s_start + timedelta(minutes=25)
                    events.append({
                        "title": f"공부 [{s+1}/{sets}세트] 25분",
                        "category": "study",
                        "start_at": s_start.isoformat(),
                        "end_at": s_end.isoformat(),
                        "note": f"Twin Lab 플랜: 공부 {study_delta:+.1f}h / Pomodoro",
                        "status": "planned",
                    })
            else:
                # 블록 방식: 하나의 긴 블록
                block_start = datetime(d.year, d.month, d.day, 10, 0)
                block_end = block_start + timedelta(hours=target_hours)
                events.append({
                    "title": f"공부 블록 {target_hours:.1f}h",
                    "category": "study",
                    "start_at": block_start.isoformat(),
                    "end_at": block_end.isoformat(),
                    "note": f"Twin Lab 플랜: 공부 {study_delta:+.1f}h",
                    "status": "planned",
                })

    # ─── 운동 이벤트 (주 N회) ────────────────────────────────────────────────
    if exercise_delta > 0:
        sessions_per_week = max(1, round(exercise_delta))
        # 선호 운동 요일
        raw_days = prefs.get("exercise_days", [])
        day_map = {"MON": 0, "TUE": 1, "WED": 2, "THU": 3, "FRI": 4, "SAT": 5, "SUN": 6}
        preferred_weekdays = [day_map[d] for d in raw_days if d in day_map] or _WEEKDAY_DEFAULT_EXERCISE
        target_weekdays = preferred_weekdays[:sessions_per_week]

        weeks = max(1, horizon_days // 7)
        for week in range(weeks):
            for wd in target_weekdays:
                # 이번 주의 해당 요일 날짜 찾기
                start_of_range = today + timedelta(days=week * 7 + 1)
                days_until = (wd - start_of_range.weekday()) % 7
                exercise_date = start_of_range + timedelta(days=days_until)
                if (exercise_date - today).days > horizon_days:
                    continue
                ex_start = datetime(exercise_date.year, exercise_date.month, exercise_date.day, 7, 0)
                ex_end = ex_start + timedelta(minutes=45)
                events.append({
                    "title": "운동 45분",
                    "category": "health",
                    "start_at": ex_start.isoformat(),
                    "end_at": ex_end.isoformat(),
                    "note": f"Twin Lab 플랜: 운동 주 {sessions_per_week}회",
                    "status": "planned",
                })

    # ─── 소비 예산 알림 (주간) ───────────────────────────────────────────────
    if spend_reduction > 0:
        reduction_pct = spend_reduction * 10
        weeks = max(1, horizon_days // 7)
        for week in range(weeks):
            check_date = today + timedelta(days=week * 7 + 1)
            check_dt = datetime(check_date.year, check_date.month, check_date.day, 8, 0)
            events.append({
                "title": f"주간 소비 목표 체크 (-{reduction_pct:.0f}% 목표)",
                "category": "general",
                "start_at": check_dt.isoformat(),
                "end_at": (check_dt + timedelta(minutes=15)).isoformat(),
                "note": f"Twin Lab 플랜: 소비 {reduction_pct:.0f}% 절감 목표",
                "status": "planned",
            })

    # ─── 집중 모드 / 폰 제한 알림 (매일) ────────────────────────────────────
    if phone_reduction > 0:
        reduction_min = phone_reduction * 30
        for day_offset in range(min(horizon_days, 14)):
            d = today + timedelta(days=day_offset + 1)
            focus_start = datetime(d.year, d.month, d.day, 20, 0)  # 저녁 8시
            focus_end = focus_start + timedelta(minutes=int(reduction_min))
            events.append({
                "title": f"집중 모드 / 폰 제한 ({int(reduction_min)}분)",
                "category": "general",
                "start_at": focus_start.isoformat(),
                "end_at": focus_end.isoformat(),
                "note": f"Twin Lab 플랜: 휴대폰 -{int(reduction_min)}분",
                "status": "planned",
            })

    # ─── DB 저장 ─────────────────────────────────────────────────────────────
    draft = ScheduleDraft(
        user_id=user_id,
        plan_name=plan_name,
        events=json.dumps(events, ensure_ascii=False),
        status="draft",
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


def apply_draft(db: Session, draft: ScheduleDraft) -> int:
    """
    ScheduleDraft의 이벤트를 Task 테이블에 일괄 등록한다.
    반환값: 생성된 Task 수
    """
    from app.models.task import Task

    events = json.loads(draft.events)
    created = 0
    for ev in events:
        task = Task(
            user_id=draft.user_id,
            title=ev["title"],
            category=ev.get("category", "general"),
            start_at=_parse_dt(ev["start_at"]),
            end_at=_parse_dt(ev["end_at"]),
            status=ev.get("status", "planned"),
            visibility="private",
        )
        # note 필드는 Task 모델에 없으므로 title에 포함
        db.add(task)
        created += 1

    draft.status = "applied"
    db.commit()
    return created


def _parse_dt(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return datetime.now()
