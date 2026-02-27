import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { goalsApi } from "../api/client";

function decodeEmail(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || "사용자";
  } catch {
    return "사용자";
  }
}

const GOAL_TYPES = [
  { value: "daily", label: "매일" },
  { value: "weekly", label: "매주" },
  { value: "monthly", label: "매월" },
  { value: "6months", label: "6개월 후" },
  { value: "1year", label: "1년 후" },
];

export default function GoalPage() {
  const navigate = useNavigate();
  const { token, logout } = useAuth();

  const email = decodeEmail(token);
  const storageKey = `twin-time-goals-${email}`;

  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [goalType, setGoalType] = useState("daily");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const serverGoals = await goalsApi.list();
        if (serverGoals.length === 0) {
          // localStorage 마이그레이션 (1회성)
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const local = JSON.parse(raw) || [];
            const normalized = local.map((g) =>
              typeof g === "string" ? { text: g, type: "daily" } : g
            );
            if (normalized.length > 0) {
              const migrated = await goalsApi.bulk(normalized);
              localStorage.removeItem(storageKey);
              setGoals(migrated);
              return;
            }
          }
        }
        setGoals(serverGoals);
      } catch {
        // 오프라인 폴백
        try {
          const data = JSON.parse(localStorage.getItem(storageKey)) || [];
          setGoals(data.map((g) => (typeof g === "string" ? { text: g, type: "daily" } : g)));
        } catch {
          setGoals([]);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function addGoal() {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (goals.some((g) => g.text === trimmed)) return;
    try {
      const created = await goalsApi.create(trimmed, goalType);
      setGoals((prev) => [...prev, created]);
      setInput("");
      flashSaved();
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeGoal(id) {
    try {
      await goalsApi.delete(id);
      setGoals((prev) => prev.filter((g) => g.id !== id));
      flashSaved();
    } catch (err) {
      alert(err.message);
    }
  }

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") addGoal();
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <button
          className="app-header-logo"
          style={{ background: "none", border: "none", cursor: "pointer" }}
          onClick={() => navigate("/")}
        >
          <img src="/assets/twinny/twinny_open.png" className="header-logo-img" alt="" />
          Twin Time
        </button>
        <button className="btn btn-ghost" onClick={logout}>
          로그아웃
        </button>
      </header>

      <div className="edit-main">
        <div className="edit-card">
          <div className="edit-card-header">
            <span className="edit-card-icon">🔥</span>
            <h2 className="edit-card-title">나의 목표</h2>
            {saved && <span className="edit-saved-badge">저장됨 ✓</span>}
          </div>
          <p className="edit-card-desc">홈 화면에 표시될 나만의 목표를 추가해보세요.</p>

          {/* 목표 기간 선택 */}
          <div className="goal-type-section">
            <span className="goal-type-section-label">목표 기간</span>
            <div className="goal-type-row">
              {GOAL_TYPES.map((t) => (
                <button
                  key={t.value}
                  className={`goal-type-chip${goalType === t.value ? " selected" : ""}`}
                  onClick={() => setGoalType(t.value)}
                  type="button"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="edit-goal-input-row">
            <input
              className="edit-goal-input"
              type="text"
              placeholder="목표를 입력하세요 (예: 운동 30분)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={40}
            />
            <button className="btn btn-primary edit-goal-add-btn" onClick={addGoal}>
              추가
            </button>
          </div>

          {loading ? (
            <div className="edit-goals-empty">불러오는 중...</div>
          ) : goals.length === 0 ? (
            <div className="edit-goals-empty">아직 목표가 없어요. 첫 번째 목표를 추가해보세요!</div>
          ) : (
            <ul className="edit-goals-list">
              {goals.map((g) => (
                <li key={g.id} className="edit-goal-item">
                  <span className="goal-type-badge">
                    {GOAL_TYPES.find((t) => t.value === g.type)?.label ?? g.type}
                  </span>
                  <span className="edit-goal-text">{g.text}</span>
                  <button
                    className="edit-goal-delete"
                    onClick={() => removeGoal(g.id)}
                    aria-label="삭제"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button className="btn btn-ghost edit-back-btn" onClick={() => navigate(-1)}>
          ← 돌아가기
        </button>
      </div>
    </div>
  );
}
