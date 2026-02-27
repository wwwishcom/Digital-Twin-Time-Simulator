/**
 * TwinnyPanel — Twinny 캐릭터 + 상태 요약 + 추천 + Explain 토글
 *
 * Props:
 *   summaryText     : Twinny 한 문단 요약
 *   riskLevel       : "낮음" | "중간" | "높음"
 *   recommendations : string[] 추천 행동 1~2개
 *   evidence        : string[] 근거 bullet (Explain 토글)
 *   loading         : 로딩 상태
 */
import { useState } from "react";
import Twinny from "./Twinny";

const RISK_COLORS = {
  낮음: { bg: "#d1fae5", text: "#065f46" },
  중간: { bg: "#fef3c7", text: "#92400e" },
  높음: { bg: "#fee2e2", text: "#991b1b" },
};

export default function TwinnyPanel({ summaryText, riskLevel, recommendations = [], evidence = [], loading = false }) {
  const [showExplain, setShowExplain] = useState(false);

  const riskStyle = RISK_COLORS[riskLevel] || RISK_COLORS["낮음"];

  if (loading) {
    return (
      <div className="twinny-panel twinny-panel--loading">
        <div className="twinny-panel-char">
          <Twinny size={90} />
        </div>
        <div className="twinny-panel-body">
          <div className="twinny-skeleton twinny-skeleton--line" />
          <div className="twinny-skeleton twinny-skeleton--line short" />
        </div>
      </div>
    );
  }

  return (
    <div className="twinny-panel">
      {/* 캐릭터 */}
      <div className="twinny-panel-char">
        <Twinny size={90} />
        <span className="twinny-panel-name">Twinny</span>
      </div>

      {/* 텍스트 영역 */}
      <div className="twinny-panel-body">
        {/* 위험도 뱃지 */}
        <div className="twinny-panel-risk">
          <span
            className="twinny-risk-badge"
            style={{ background: riskStyle.bg, color: riskStyle.text }}
          >
            리스크 {riskLevel}
          </span>
        </div>

        {/* 요약 */}
        <p className="twinny-panel-summary">{summaryText || "오늘도 파이팅! 기록을 쌓으면 더 정확한 분석이 가능해져."}</p>

        {/* 추천 */}
        {recommendations.length > 0 && (
          <ul className="twinny-panel-recs">
            {recommendations.map((rec, i) => (
              <li key={i} className="twinny-panel-rec-item">
                <span className="twinny-rec-bullet">💡</span>
                {rec}
              </li>
            ))}
          </ul>
        )}

        {/* Explain 토글 */}
        {evidence.length > 0 && (
          <div className="twinny-panel-explain">
            <button
              className="twinny-explain-btn"
              onClick={() => setShowExplain((v) => !v)}
            >
              {showExplain ? "▲ 근거 숨기기" : "▼ 왜 이렇게 말했나요?"}
            </button>
            {showExplain && (
              <ul className="twinny-explain-list">
                {evidence.map((ev, i) => (
                  <li key={i} className="twinny-explain-item">
                    <span>📊</span> {ev}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
