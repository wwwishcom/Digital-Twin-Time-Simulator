/**
 * SimulationSlider — 변수 슬라이더 (현재값 표시 + 목표값 조정)
 *
 * Props:
 *   label       : 변수 이름
 *   unit        : 단위 문자열 (예: "시간", "회/주")
 *   min         : 슬라이더 최솟값
 *   max         : 슬라이더 최댓값
 *   step        : 슬라이더 step
 *   value       : 현재 선택 값 (변화량 delta, 또는 절대값)
 *   isDelta     : true면 ±변화량, false면 절대값
 *   onChange    : (value: number) => void
 *   icon        : 이모지
 *   color       : 강조 색
 */
export default function SimulationSlider({
  label,
  unit = "",
  min = -3,
  max = 3,
  step = 0.5,
  value = 0,
  isDelta = true,
  onChange,
  icon = "⚙️",
  color = "#fbcfe8",
}) {
  const displayValue = isDelta
    ? `${value >= 0 ? "+" : ""}${value}${unit}`
    : `${value}${unit}`;

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="sim-slider" style={{ "--sim-color": color }}>
      <div className="sim-slider-header">
        <span className="sim-slider-icon">{icon}</span>
        <span className="sim-slider-label">{label}</span>
        <span
          className="sim-slider-value"
          style={{ color: isDelta && value > 0 ? "#059669" : isDelta && value < 0 ? "#dc2626" : "#5c3a4a" }}
        >
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange && onChange(parseFloat(e.target.value))}
        className="sim-range-input"
        style={{
          "--range-pct": `${percentage}%`,
          "--range-color": color,
        }}
      />
      <div className="sim-slider-minmax">
        <span>{isDelta ? `${min > 0 ? "+" : ""}${min}${unit}` : `${min}${unit}`}</span>
        <span>{isDelta ? `+${max}${unit}` : `${max}${unit}`}</span>
      </div>
    </div>
  );
}
