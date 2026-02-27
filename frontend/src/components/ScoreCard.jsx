/**
 * ScoreCard — 0~100 스코어를 원형 게이지 + 추세 뱃지 + 스파클라인으로 표시
 *
 * Props:
 *   label    : 스코어 이름 (에너지, 멘탈, 집중, 목표)
 *   score    : 현재 스코어 0~100
 *   delta    : 전날 대비 변화량 (±숫자, null이면 숨김)
 *   trend    : 최근 7일 스코어 배열 (없으면 스파클라인 숨김)
 *   icon     : 이모지 아이콘
 *   color    : 카드 강조 색상 (hex)
 */
export default function ScoreCard({ label, score = 0, delta, trend = [], icon, color = "#ffb3c1" }) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  // SVG 원형 게이지
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clampedScore / 100);

  // 스코어 색상 결정
  const scoreColor =
    clampedScore >= 70 ? "#34d399" :
    clampedScore >= 40 ? "#fbbf24" : "#f87171";

  // 델타 표시
  const deltaText =
    delta != null
      ? `${delta >= 0 ? "+" : ""}${Math.round(delta)}`
      : null;
  const deltaColor = delta >= 0 ? "#34d399" : "#f87171";

  // 스파클라인 SVG (간단한 선 그래프)
  const sparkline = trend.length >= 2 ? renderSparkline(trend, color) : null;

  return (
    <div className="score-card" style={{ "--accent": color }}>
      <div className="score-card-header">
        <span className="score-card-icon">{icon}</span>
        <span className="score-card-label">{label}</span>
        {deltaText && (
          <span className="score-card-delta" style={{ color: deltaColor }}>
            {deltaText}
          </span>
        )}
      </div>

      {/* 원형 게이지 */}
      <div className="score-card-gauge">
        <svg width="90" height="90" viewBox="0 0 90 90">
          {/* 배경 링 */}
          <circle
            cx="45" cy="45" r={radius}
            fill="none"
            stroke="#f3e8ee"
            strokeWidth="8"
          />
          {/* 스코어 링 */}
          <circle
            cx="45" cy="45" r={radius}
            fill="none"
            stroke={scoreColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 45 45)"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
          {/* 스코어 텍스트 */}
          <text x="45" y="50" textAnchor="middle" fontSize="20" fontWeight="700" fill="#5c3a4a">
            {clampedScore}
          </text>
        </svg>
      </div>

      {/* 스파클라인 */}
      {sparkline && (
        <div className="score-card-sparkline">
          {sparkline}
          <span className="score-card-spark-label">최근 7일</span>
        </div>
      )}
    </div>
  );
}

function renderSparkline(data, color) {
  const w = 80, h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 마지막 점 강조 */}
      {points.length > 0 && (() => {
        const last = points[points.length - 1].split(",");
        return (
          <circle
            cx={parseFloat(last[0])}
            cy={parseFloat(last[1])}
            r="3"
            fill={color}
          />
        );
      })()}
    </svg>
  );
}
