"""
Twin Lab 시뮬레이션 계수 설정

각 변수의 변화량이 4가지 스코어에 미치는 영향을 정의한다.
- 단위: 스코어 포인트 per 단위 변화
- 음수: 해당 스코어에 부정적 영향

변수 목록:
  sleep_hours           : 수면 시간 변화 (시간 단위)
  study_hours           : 공부 시간 변화 (시간 단위)
  exercise_per_week     : 주당 운동 횟수 변화 (회 단위)
  spend_reduction_10pct : 소비 10% 감소 단위
  phone_minus_30min     : 휴대폰 30분 감소 단위
"""

# 기본 계수 — 변수 단위 1당 스코어 변화량
SIM_COEFFICIENTS: dict[str, dict[str, float]] = {
    "sleep_hours": {
        "energy": 12.0,
        "mental": 5.0,
        "focus": 3.0,
        "goal_progress": 2.0,
    },
    "study_hours": {
        "energy": -2.0,     # 피로 증가
        "mental": -1.5,     # 스트레스 증가
        "focus": 10.0,
        "goal_progress": 8.0,
    },
    "exercise_per_week": {
        "energy": 8.0,
        "mental": 5.0,
        "focus": 3.0,
        "goal_progress": 5.0,
    },
    "spend_reduction_10pct": {
        "energy": 0.0,
        "mental": 4.0,
        "focus": 2.0,
        "goal_progress": 3.0,
    },
    "phone_minus_30min": {
        "energy": 2.0,
        "mental": 3.0,
        "focus": 8.0,
        "goal_progress": 2.0,
    },
}

# 상충 효과 (side effects) — 특정 조건에서 추가 보정
# (변수, 임계값, 초과 시 추가 효과)
SIM_SIDE_EFFECTS: list[dict] = [
    # 공부 시간이 3시간 이상 증가하면 멘탈 추가 감소
    {
        "variable": "study_hours",
        "threshold": 3.0,
        "above_threshold_extra": {"mental": -3.0, "energy": -3.0},
    },
    # 수면이 2시간 이상 증가하면 목표 진행률 추가 상승 (수면 부채 해소)
    {
        "variable": "sleep_hours",
        "threshold": 2.0,
        "above_threshold_extra": {"goal_progress": 3.0},
    },
]

# 7일/30일 감쇠 계수 — 30일은 초기 효과 후 안정화 반영
HORIZON_MULTIPLIER: dict[int, float] = {
    7: 1.0,
    30: 0.75,   # 30일 후에는 약 75% 수준으로 안정화
}
