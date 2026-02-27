import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { lifeScoresApi, twinnyApi } from "../api/client";
import ScoreCard from "../components/ScoreCard";

const MOCK_TODAY = { energy: 62, mental: 55, focus: 78, goal_progress: 45 };
const MOCK_TREND = {
  energy:       [50, 55, 58, 60, 57, 62, 62],
  mental:       [60, 58, 55, 53, 50, 55, 55],
  focus:        [65, 68, 70, 72, 75, 78, 78],
  goal_progress:[35, 38, 40, 42, 43, 45, 45],
};
const MOCK_SUMMARY = "기록이 쌓이면 더 정확하게 알려줄 수 있어!";

const SCORE_META = [
  { key: "energy",        label: "에너지", icon: "⚡", color: "#ffd6e0" },
  { key: "mental",        label: "멘탈",   icon: "🧘", color: "#c7d2fe" },
  { key: "focus",         label: "집중",   icon: "🎯", color: "#bbf7d0" },
  { key: "goal_progress", label: "목표",   icon: "🏆", color: "#fed7aa" },
];

export default function TwinLabPage() {
  const navigate = useNavigate();

  const [todayScores, setTodayScores] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [twinnyMsg, setTwinnyMsg] = useState(MOCK_SUMMARY);
  const [loadingToday, setLoadingToday] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      lifeScoresApi.today(),
      lifeScoresApi.list(),
      twinnyApi.summary(),
    ]).then(([todayRes, historyRes, twinnyRes]) => {
      if (todayRes.status === "fulfilled") {
        const s = todayRes.value;
        setTodayScores({ energy: s.energy, mental: s.mental, focus: s.focus, goal_progress: s.goal_progress });
      } else {
        setTodayScores(MOCK_TODAY);
      }

      if (historyRes.status === "fulfilled" && historyRes.value.length > 0) {
        const h = historyRes.value;
        const trend = {};
        SCORE_META.forEach(({ key }) => { trend[key] = h.map((s) => s[key]); });
        setTrendData(trend);
      } else {
        setTrendData(MOCK_TREND);
      }

      if (twinnyRes.status === "fulfilled" && twinnyRes.value?.summary_text) {
        setTwinnyMsg(twinnyRes.value.summary_text);
      }
    }).finally(() => setLoadingToday(false));
  }, []);

  const display = todayScores || MOCK_TODAY;
  const displayTrend = trendData || MOCK_TREND;

  return (
    <div className="app-layout">
      <header className="app-header">
        <button className="btn btn-ghost" onClick={() => navigate("/")}>
          ← 홈
        </button>
        <span className="app-header-logo" style={{ fontSize: "1rem" }}>
          Twin Lab
        </span>
        <button className="btn btn-ghost" onClick={() => navigate("/logs")}>
          기록 +
        </button>
      </header>

      <div className="twin-lab-main">

        {/* ── ① 오늘의 나 ─────────────────────────────────────────────── */}
        <section className="tl-section">
          <h3 className="tl-section-title">오늘의 나</h3>
          <div className="score-cards-grid">
            {SCORE_META.map(({ key, label, icon, color }) => (
              <ScoreCard
                key={key}
                label={label}
                score={loadingToday ? 0 : display[key]}
                trend={displayTrend[key] || []}
                icon={icon}
                color={color}
              />
            ))}
          </div>

          <div className="tl-twinny-brief">
            <span className="tl-twinny-icon">🐾</span>
            <span className="tl-twinny-text">{twinnyMsg}</span>
          </div>
        </section>

        {/* ── ② 트윈 선택 ─────────────────────────────────────────────── */}
        <section className="tl-section">
          <h3 className="tl-section-title">나의 트윈</h3>
          <div className="tl-twin-entry-grid">
            <button
              className="tl-twin-entry-btn tl-twin-goal"
              onClick={() => navigate("/goal-twin")}
            >
              <span className="tl-twin-entry-icon">🎯</span>
              <span className="tl-twin-entry-label">Goal Twin</span>
              <span className="tl-twin-entry-desc">
                목표별 프로젝트 관리<br />할 일 · 달성률 · 마감 예측
              </span>
              <span className="tl-twin-entry-arrow">→</span>
            </button>

            <button
              className="tl-twin-entry-btn tl-twin-selfcare"
              onClick={() => navigate("/self-care-twin")}
            >
              <span className="tl-twin-entry-icon">💚</span>
              <span className="tl-twin-entry-label">Self-care Twin</span>
              <span className="tl-twin-entry-desc">
                수면 · 운동 · 감정 기록<br />친구 비교 · Twin Wallet
              </span>
              <span className="tl-twin-entry-arrow">→</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
