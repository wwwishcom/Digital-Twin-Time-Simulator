import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { lifeScoresApi, twinnyApi } from "../api/client";
import ScoreCard from "../components/ScoreCard";
import TwinnyPanel from "../components/TwinnyPanel";

// ─── 더미 데이터 (API 연결 전 UI 확인용) ────────────────────────────────────
const MOCK_SCORES = {
  energy: 62,
  mental: 55,
  focus: 78,
  goal_progress: 45,
};

const MOCK_TREND = {
  energy:       [50, 55, 58, 60, 57, 62, 62],
  mental:       [60, 58, 55, 53, 50, 55, 55],
  focus:        [65, 68, 70, 72, 75, 78, 78],
  goal_progress:[35, 38, 40, 42, 43, 45, 45],
};

const MOCK_SUMMARY = {
  summary_text: "최근 공부 집중도가 좋은 흐름이야! 다만 수면이 조금 부족해서 에너지가 떨어지고 있어. 오늘 취침 시간을 30분 앞당겨봐.",
  risk_level: "중간",
  recommendations: [
    "오늘 취침 목표를 30분 앞당겨봐요",
    "25분 × 4세트 Pomodoro로 집중력을 유지해요",
  ],
  evidence: [
    "수면 평균 5.8시간 (최근 3일 기준)",
    "공부 집중도 평균 4.2 / 5.0",
    "에너지 스코어 62 / 100",
  ],
  triggers: ["LOW_SLEEP_3D", "HIGH_FOCUS"],
};

const SCORE_CARDS = [
  { key: "energy",       label: "에너지",   icon: "⚡", color: "#ffd6e0" },
  { key: "mental",       label: "멘탈",     icon: "🧘", color: "#c7d2fe" },
  { key: "focus",        label: "집중",     icon: "🎯", color: "#bbf7d0" },
  { key: "goal_progress",label: "목표",     icon: "🏆", color: "#fed7aa" },
];

export default function LifeHubPage() {
  const navigate = useNavigate();
  const [scores, setScores] = useState(null);
  const [prevScores, setPrevScores] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // 오늘 스코어 + 7일 트렌드 병렬 조회
      const [todayScore, historyScores, twinnySummary] = await Promise.allSettled([
        lifeScoresApi.today(),
        lifeScoresApi.list(),
        twinnyApi.summary(),
      ]);

      // 오늘 스코어
      if (todayScore.status === "fulfilled") {
        const s = todayScore.value;
        setScores({ energy: s.energy, mental: s.mental, focus: s.focus, goal_progress: s.goal_progress });
      } else {
        setScores(MOCK_SCORES);
      }

      // 트렌드 & 전날 델타
      if (historyScores.status === "fulfilled" && historyScores.value.length > 0) {
        const history = historyScores.value;
        const trend = {};
        SCORE_CARDS.forEach(({ key }) => {
          trend[key] = history.map((s) => s[key]);
        });
        setTrendData(trend);

        if (history.length >= 2) {
          const yesterday = history[history.length - 2];
          const today = history[history.length - 1];
          setPrevScores({
            energy: today.energy - yesterday.energy,
            mental: today.mental - yesterday.mental,
            focus: today.focus - yesterday.focus,
            goal_progress: today.goal_progress - yesterday.goal_progress,
          });
        }
      } else {
        setTrendData(MOCK_TREND);
      }

      // Twinny 요약
      if (twinnySummary.status === "fulfilled") {
        setSummary(twinnySummary.value);
      } else {
        setSummary(MOCK_SUMMARY);
      }
    } catch (e) {
      setError("데이터를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
      setScores(MOCK_SCORES);
      setTrendData(MOCK_TREND);
      setSummary(MOCK_SUMMARY);
    } finally {
      setLoading(false);
    }
  }

  const displayScores = scores || MOCK_SCORES;
  const displayTrend = trendData || MOCK_TREND;
  const displaySummary = summary || MOCK_SUMMARY;

  return (
    <div className="app-layout">
      <header className="app-header">
        <button className="btn btn-ghost" onClick={() => navigate("/")}>
          ← 홈
        </button>
        <span className="app-header-logo">Life Hub</span>
        <button className="btn btn-ghost" onClick={() => navigate("/twin-lab")}>
          Twin Lab →
        </button>
      </header>

      <div className="life-hub-main">
        <div className="life-hub-title-row">
          <h2 className="life-hub-title">오늘의 나</h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate("/logs")}
          >
            + 기록 추가
          </button>
        </div>

        {error && (
          <div className="error-banner">{error}</div>
        )}

        {/* ── 스코어 카드 4개 ── */}
        <div className="score-cards-grid">
          {SCORE_CARDS.map(({ key, label, icon, color }) => (
            <ScoreCard
              key={key}
              label={label}
              score={loading ? 0 : displayScores[key]}
              delta={prevScores ? prevScores[key] : null}
              trend={displayTrend[key] || []}
              icon={icon}
              color={color}
            />
          ))}
        </div>

        {/* ── Twinny 패널 ── */}
        <TwinnyPanel
          summaryText={displaySummary.summary_text}
          riskLevel={displaySummary.risk_level}
          recommendations={displaySummary.recommendations}
          evidence={displaySummary.evidence}
          loading={loading}
        />

        {/* ── 하단 바로가기 ── */}
        <div className="life-hub-actions">
          <button
            className="btn btn-primary"
            onClick={() => navigate("/twin-lab")}
          >
            🧪 Twin Lab에서 실험해보기
          </button>
          <button
            className="btn btn-secondary"
            onClick={loadData}
          >
            🔄 새로고침
          </button>
        </div>
      </div>
    </div>
  );
}
