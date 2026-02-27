"""
Group Project AI 피드백 서비스

Anthropic Claude API를 통해:
1. 그룹 프로젝트 역할 분배 개선 추천
2. 멤버 진행 상황에 대한 피드백 제공

인터페이스 분리 원칙: generate_project_feedback() 함수 시그니처를 유지하면
내부 모델 교체 가능.
"""
from __future__ import annotations

import json
import os
from typing import Optional

import anthropic


def _build_prompt(project, tasks, member_activity: list[dict]) -> str:
    task_lines = []
    for t in tasks:
        assignee = t.assignee.nickname if t.assignee and t.assignee.nickname else (
            t.assignee.email.split("@")[0] if t.assignee else "미배정"
        )
        status = "완료" if t.is_done else ("기한초과" if getattr(t, "is_overdue", False) else "진행중")
        deadline = t.deadline or "마감없음"
        task_lines.append(f"  - [{status}] {t.title} (담당: {assignee}, 마감: {deadline})")

    member_lines = []
    for m in member_activity:
        sleep_str = f"{m['avg_sleep']}시간" if m.get("avg_sleep") is not None else "데이터없음"
        member_lines.append(
            f"  - {m['nickname']}: 평균수면 {sleep_str}, "
            f"태스크완료 {m['done_count']}/{m['total_count']}"
        )

    deadline_str = project.deadline or "미정"
    desc_str = project.description or "없음"

    prompt = f"""당신은 팀 프로젝트 관리 전문가입니다. 아래 그룹 프로젝트 정보를 분석하고 한국어로 피드백을 제공해주세요.

## 프로젝트 정보
- 이름: {project.title}
- 설명: {desc_str}
- 마감일: {deadline_str}

## 현재 태스크 목록
{chr(10).join(task_lines) if task_lines else "  (태스크 없음)"}

## 멤버 활동 현황 (최근 7일)
{chr(10).join(member_lines) if member_lines else "  (데이터 없음)"}

위 정보를 바탕으로 다음을 JSON 형식으로 답변해주세요:
{{
  "feedback_text": "전반적인 프로젝트 진행 상황에 대한 피드백 (2-3문장)",
  "role_suggestions": [
    {{
      "task_title": "태스크명",
      "suggested_nickname": "추천 담당자 닉네임",
      "reason": "추천 이유 (1문장)"
    }}
  ]
}}

역할 분배가 적절하다면 role_suggestions는 빈 배열로 반환하세요.
반드시 JSON만 반환하고 다른 텍스트는 포함하지 마세요."""
    return prompt


def generate_project_feedback(project, tasks, member_activity: list[dict]) -> dict:
    """
    그룹 프로젝트 AI 피드백 생성

    Returns:
        {
            "feedback_text": str,
            "role_suggestions": [{"task_title": str, "suggested_nickname": str, "reason": str}]
        }
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return {
            "feedback_text": "AI 피드백을 사용하려면 ANTHROPIC_API_KEY 환경변수를 설정해주세요.",
            "role_suggestions": [],
        }

    try:
        client = anthropic.Anthropic(api_key=api_key)
        prompt = _build_prompt(project, tasks, member_activity)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # JSON 파싱
        result = json.loads(raw)
        return {
            "feedback_text": result.get("feedback_text", ""),
            "role_suggestions": result.get("role_suggestions", []),
        }
    except json.JSONDecodeError:
        # JSON 파싱 실패 시 텍스트만 반환
        return {
            "feedback_text": raw if "raw" in dir() else "AI 응답을 파싱할 수 없습니다.",
            "role_suggestions": [],
        }
    except Exception as e:
        return {
            "feedback_text": f"AI 피드백 생성 중 오류가 발생했습니다: {str(e)}",
            "role_suggestions": [],
        }
