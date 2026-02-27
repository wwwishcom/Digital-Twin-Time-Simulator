"""
개인 프로젝트 Twinny AI 피드백 서비스

사용자의 프로젝트 정보 + 태스크(메모 포함) + 라이프 스코어를 분석하여
Twinny 캐릭터 페르소나로 피드백을 제공합니다.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta
from typing import Optional


def _parse_reset_duration(reset_str: str) -> Optional[str]:
    """Anthropic 응답 헤더의 리셋 시간 문자열 파싱 (예: '1m30s', '5m', '1h')
    반환: HH:MM 형태의 이용 가능 시각 문자열"""
    if not reset_str:
        return None
    total_secs = 0
    for val, unit in re.findall(r"(\d+)([hms])", reset_str):
        if unit == "h":
            total_secs += int(val) * 3600
        elif unit == "m":
            total_secs += int(val) * 60
        elif unit == "s":
            total_secs += int(val)
    if total_secs == 0:
        return None
    reset_at = datetime.now() + timedelta(seconds=total_secs)
    return reset_at.strftime("%H:%M")


def _sleeping_response(available_at: Optional[str] = None) -> dict:
    if available_at:
        msg = f"Twinny가 자러 갈 시간이에요 🌙 {available_at}에 다시 만나요!"
    else:
        msg = "Twinny가 자러 갈 시간이에요 🌙 다음에 이용해주세요!"
    return {
        "summary_text": msg,
        "risk_level": "낮음",
        "recommendations": [],
        "evidence": [],
        "sleeping": True,
        "available_at": available_at,
    }


def _build_prompt(project, tasks, nickname: str, life_context: dict) -> str:
    task_lines = []
    for t in tasks:
        status = "완료" if t.is_done else "진행중"
        memo_str = f" [메모: {t.memo}]" if t.memo else ""
        est = f" ({t.estimated_hours}h)" if t.estimated_hours else ""
        task_lines.append(f"  - [{status}] {t.title}{est}{memo_str}")

    desc_str = project.description or "없음"
    deadline_str = project.deadline or "미정"

    sleep_str = f"{life_context['avg_sleep']}시간" if life_context.get("avg_sleep") is not None else "데이터 없음"
    energy_str = f"{life_context['energy']}/100" if life_context.get("energy") is not None else "데이터 없음"
    focus_str = f"{life_context['focus']}/100" if life_context.get("focus") is not None else "데이터 없음"
    mental_str = f"{life_context['mental']}/100" if life_context.get("mental") is not None else "데이터 없음"

    total = len(tasks)
    done = sum(1 for t in tasks if t.is_done)
    completion_pct = round(done / total * 100, 1) if total > 0 else 0

    prompt = f"""당신은 Twinny입니다. {nickname}님의 디지털 트윈으로서, 따뜻하고 친근한 말투로 한국어로 답해주세요.
Twinny는 {nickname}님을 잘 아는 존재로서, 데이터를 기반으로 진심 어린 조언을 드립니다.

## {nickname}님의 프로젝트
- 제목: {project.title}
- 설명: {desc_str}
- 마감일: {deadline_str}
- 진행률: {completion_pct}% ({done}/{total} 완료)

## 태스크 목록
{chr(10).join(task_lines) if task_lines else "  (태스크 없음)"}

## {nickname}님의 최근 생활 데이터
- 평균 수면 (7일): {sleep_str}
- 에너지 스코어: {energy_str}
- 집중 스코어: {focus_str}
- 멘탈 스코어: {mental_str}

위 정보를 종합해서 다음 JSON 형식으로만 답변해주세요:
{{
  "summary_text": "Twinny의 따뜻한 한 줄 총평 (30-50자, '{nickname}님' 호칭 사용)",
  "risk_level": "낮음 또는 중간 또는 높음",
  "recommendations": [
    "구체적인 추천 행동 1 (1문장)",
    "구체적인 추천 행동 2 (1문장)"
  ],
  "evidence": [
    "근거가 되는 수치나 패턴 1",
    "근거가 되는 수치나 패턴 2"
  ]
}}

risk_level 기준:
- 낮음: 프로젝트가 잘 진행되고 있고 생활 데이터도 안정적
- 중간: 진행이 다소 느리거나 생활 데이터가 우려됨
- 높음: 마감이 촉박하거나 생활 데이터가 심각하게 저하됨

반드시 JSON만 반환하고 다른 텍스트는 포함하지 마세요."""
    return prompt


def generate_project_twinny_feedback(
    project,
    tasks,
    nickname: str,
    life_context: dict,
) -> dict:
    """
    개인 프로젝트에 대한 Twinny AI 피드백 생성

    Returns:
        {
            "summary_text": str,
            "risk_level": str,       # "낮음" / "중간" / "높음"
            "recommendations": [str],
            "evidence": [str],
            "sleeping": bool,        # True 이면 무료 한도 초과
            "available_at": str|None # HH:MM 형태 or None
        }
    """
    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return {
            "summary_text": "AI 피드백을 사용하려면 ANTHROPIC_API_KEY 환경변수를 설정해주세요.",
            "risk_level": "낮음",
            "recommendations": [],
            "evidence": [],
            "sleeping": False,
            "available_at": None,
        }

    try:
        client = anthropic.Anthropic(api_key=api_key)
        prompt = _build_prompt(project, tasks, nickname, life_context)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        result = json.loads(raw)
        return {
            "summary_text": result.get("summary_text", ""),
            "risk_level": result.get("risk_level", "낮음"),
            "recommendations": result.get("recommendations", []),
            "evidence": result.get("evidence", []),
            "sleeping": False,
            "available_at": None,
        }

    except anthropic.RateLimitError as e:
        # 무료 티어 속도 제한 — 헤더에서 리셋 시간 추출
        available_at = None
        try:
            headers = e.response.headers
            reset_str = (
                headers.get("x-ratelimit-reset-requests")
                or headers.get("x-ratelimit-reset-tokens")
            )
            available_at = _parse_reset_duration(reset_str)
        except Exception:
            pass
        return _sleeping_response(available_at)

    except anthropic.PermissionDeniedError:
        # 결제 한도 초과 또는 무료 크레딧 소진
        return _sleeping_response(None)

    except json.JSONDecodeError:
        raw_text = locals().get("raw", "")
        return {
            "summary_text": raw_text or "AI 응답을 파싱할 수 없습니다.",
            "risk_level": "낮음",
            "recommendations": [],
            "evidence": [],
            "sleeping": False,
            "available_at": None,
        }

    except Exception as e:
        err = str(e).lower()
        # billing / credit / quota 관련 메시지면 슬리핑 처리
        if any(k in err for k in ("billing", "credit", "payment", "quota", "insufficient", "overload")):
            return _sleeping_response(None)
        return {
            "summary_text": f"AI 피드백 생성 중 오류가 발생했습니다: {str(e)}",
            "risk_level": "낮음",
            "recommendations": [],
            "evidence": [],
            "sleeping": False,
            "available_at": None,
        }
