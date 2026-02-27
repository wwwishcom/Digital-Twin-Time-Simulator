/**
 * ComparisonCard — 현재 루틴 vs 실험 루틴 비교 카드
 *
 * Props:
 *   baseline   : { energy, mental, focus, goal_progress }
 *   projected  : { energy, mental, focus, goal_progress }
 *   delta      : { energy, mental, focus, goal_progress }
 *   loading    : bool
 */

const SCORE_META = [
  { key: "energy",       label: "에너지",   icon: "⚡" },
  { key: "mental",       label: "멘탈",     icon: "🧘" },
  { key: "focus",        label: "집중",     icon: "🎯" },
  { key: "goal_progress",label: "목표",     icon: "🏆" },
];

export default function ComparisonCard({ baseline, projected, delta, loading = false }) {
  if (loading) {
    return (
      <div className="comparison-card">
        <div className="comparison-card-loading">시뮬레이션 계산 중...</div>
      </div>
    );
  }

  if (!baseline || !projected) {
    return (
      <div className="comparison-card comparison-card--empty">
        슬라이더를 조정하면 예상 변화를 비교할 수 있어요
      </div>
    );
  }

  return (
    <div className="comparison-card">
      {/* 헤더 */}
      <div className="comparison-header">
        <div className="comparison-col-label">현재 루틴</div>
        <div className="comparison-col-label comparison-col-projected">실험 루틴</div>
      </div>

      {/* 스코어 행 */}
      {SCORE_META.map(({ key, label, icon }) => {
        const base = Math.round(baseline[key] || 0);
        const proj = Math.round(projected[key] || 0);
        const d = delta ? delta[key] || 0 : (proj - base);
        const isUp = d > 0;
        const isDown = d < 0;

        return (
          <div key={key} className="comparison-row">
            <div className="comparison-score-label">
              <span>{icon}</span>
              <span>{label}</span>
            </div>

            {/* 현재 바 */}
            <div className="comparison-bar-wrap">
              <div
                className="comparison-bar comparison-bar--base"
                style={{ width: `${base}%` }}
              />
              <span className="comparison-bar-num">{base}</span>
            </div>

            {/* 델타 뱃지 */}
            <div
              className="comparison-delta"
              style={{
                color: isUp ? "#059669" : isDown ? "#dc2626" : "#9ca3af",
              }}
            >
              {isUp ? `+${Math.round(d)}` : isDown ? Math.round(d) : "−"}
            </div>

            {/* 실험 바 */}
            <div className="comparison-bar-wrap">
              <div
                className="comparison-bar comparison-bar--proj"
                style={{ width: `${proj}%`, opacity: 0.85 }}
              />
              <span className="comparison-bar-num">{proj}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
