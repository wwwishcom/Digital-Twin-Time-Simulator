"""
Life Score 계산 설정
각 스코어의 구성 요소, 가중치, 정규화 기준을 정의한다.

- type: LogEntry / DailyAggregate 의 type 값
- field: DailyAggregate 에서 사용할 필드 (total / average / count)
- meta_key: meta_summary JSON 에서 꺼낼 키 (없으면 None)
- weight: 가중치 (음수 = 감점)
- scale_max: 정규화 기준 최대값 (이 값에서 1.0)
- is_boolean: True면 0/1로 처리
- window_days: 이동평균 창 크기
"""

SCORE_CONFIG: dict = {
    "energy": {
        "window_days": 7,
        "components": [
            # 수면 시간 평균 (9시간이 최적)
            {"type": "sleep", "field": "average", "weight": 0.70, "scale_max": 9.0},
            # 운동 여부 (당일 has_exercise=True)
            {"type": "health", "meta_key": "has_exercise", "weight": 0.30, "is_boolean": True},
        ],
    },
    "focus": {
        "window_days": 7,
        "components": [
            # 공부 총 시간 (최대 8시간)
            {"type": "study", "field": "total", "weight": 0.55, "scale_max": 8.0},
            # 공부 집중도 평균 (1~5)
            {"type": "study", "meta_key": "concentration_avg", "weight": 0.45, "scale_max": 5.0},
        ],
    },
    "mental": {
        "window_days": 7,
        "components": [
            # 감정 점수 평균 (1~5)
            {"type": "mood", "field": "average", "weight": 0.70, "scale_max": 5.0},
            # 충동 소비 비율 (높을수록 감점)
            {"type": "spend", "meta_key": "impulse_ratio", "weight": -0.30, "scale_max": 1.0},
        ],
    },
    "goal_progress": {
        "window_days": 30,
        "components": [
            # 공부 총 시간 (목표 기여)
            {"type": "study", "field": "total", "weight": 0.40, "scale_max": 8.0},
            # 운동 여부 (규칙적 운동 목표)
            {"type": "health", "meta_key": "has_exercise", "weight": 0.35, "is_boolean": True},
            # 저축 비율 (소비 중 비충동 비율)
            {"type": "spend", "meta_key": "savings_ratio", "weight": 0.25, "scale_max": 1.0},
        ],
    },
}
