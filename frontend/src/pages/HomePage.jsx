import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { goalsApi, twinnyApi, projectsApi, groupsApi, groupProjectsApi } from "../api/client";
import Twinny from "../components/Twinny";

function decodeEmail(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || "사용자";
  } catch {
    return "사용자";
  }
}

const GOAL_TYPE_LABELS = {
  daily: "매일",
  weekly: "매주",
  monthly: "매월",
  "6months": "6개월 후",
  "1year": "1년 후",
};

const MENU_ITEMS = [
  {
    icon: "📅",
    label: "Calendar",
    desc: "개인 일정 및\n목표 관리",
    path: "/calendar",
    color: "#fde8f3",
    border: "#fbcfe8",
  },
  {
    icon: "👥",
    label: "Hub",
    desc: "목표 공유 &\n그룹 소통",
    path: "/hub",
    color: "#dbeafe",
    border: "#bfdbfe",
  },
  {
    icon: "✏️",
    label: "Edit",
    desc: "프로필 &\n개인 설정",
    path: "/edit",
    color: "#d1fae5",
    border: "#a7f3d0",
  },
  {
    icon: "📝",
    label: "오늘의 기록",
    desc: "수면/학습/운동\n/감정",
    path: "/logs",
    color: "#fef9c3",
    border: "#fde047",
  },
  {
    icon: "🔬",
    label: "Twin Lab",
    desc: "나의 디지털 트윈\n목표·자기관리",
    path: "/twin-lab",
    color: "#ede9fe",
    border: "#c4b5fd",
  },
];

const FALLBACK_TWINNY_MSG = "기록이 쌓이면 더 정확하게 알려줄 수 있어. 눌러봐!";

export default function HomePage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const email = decodeEmail(token);

  const [goals, setGoals] = useState([]);
  const [twinnyMsg, setTwinnyMsg] = useState(FALLBACK_TWINNY_MSG);
  const [personalProjects, setPersonalProjects] = useState([]);
  const [groupProjects, setGroupProjects] = useState([]);
  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`twin-time-profile-${email}`)) || {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    goalsApi.list().then(setGoals).catch(() => {
      try {
        const data = JSON.parse(localStorage.getItem(`twin-time-goals-${email}`)) || [];
        setGoals(data.map((g) => (typeof g === "string" ? { text: g, type: "daily" } : g)));
      } catch {
        setGoals([]);
      }
    });
    // 전체 프로젝트 달성률 — 개인 + 그룹 프로젝트
    projectsApi.list().then(setPersonalProjects).catch(() => {});
    groupsApi.list().then(async (gs) => {
      const results = await Promise.allSettled(gs.map((g) => groupProjectsApi.list(g.id)));
      setGroupProjects(results.flatMap((r) => r.status === "fulfilled" ? r.value : []));
    }).catch(() => {});
    // Twinny 한 줄 요약 (실패해도 fallback 유지)
    twinnyApi.summary().then((res) => {
      if (res?.summary_text) setTwinnyMsg(res.summary_text);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const profileKey = `twin-time-profile-${email}`;
    const syncProfile = (e) => { if (e.detail) setProfile(e.detail); };
    const syncStorage = () => {
      try { setProfile(JSON.parse(localStorage.getItem(profileKey)) || {}); }
      catch { setProfile({}); }
    };
    window.addEventListener("storage", syncStorage);
    window.addEventListener("twintime-profile-update", syncProfile);
    return () => {
      window.removeEventListener("storage", syncStorage);
      window.removeEventListener("twintime-profile-update", syncProfile);
    };
  }, [email]);

  const displayName =
    profile.nickname || (email.includes("@") ? email.split("@")[0] : email);

  // 전체 프로젝트 달성률 계산 (개인 + 그룹)
  let totalProjTasks = 0;
  let doneProjTasks = 0;
  for (const proj of [...personalProjects, ...groupProjects]) {
    for (const task of (proj.tasks ?? [])) {
      totalProjTasks++;
      if (task.is_done) doneProjTasks++;
    }
  }
  const progress = totalProjTasks > 0
    ? Math.round((doneProjTasks / totalProjTasks) * 100)
    : 0;

  return (
    <div className="app-layout">
      <header className="app-header">
        <span className="app-header-logo">
          <img src="/assets/twinny/twinny_open.png" className="header-logo-img" alt="" />
          Twin Time
        </span>
        <button className="btn btn-ghost" onClick={logout}>
          로그아웃
        </button>
      </header>

      <div className="home-main">
        {/* ── 프로필 ── */}
        <section className="home-profile-card">
          <div className="home-avatar">
            {profile.profileImage ? (
              <img
                src={profile.profileImage}
                alt="프로필"
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
              />
            ) : (
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                <circle cx="17" cy="12" r="7" fill="#fbcfe8" />
                <path d="M3 33c0-7.732 6.268-14 14-14s14 6.268 14 14" fill="#fbcfe8" />
              </svg>
            )}
          </div>
          <div className="home-profile-info">
            <div className="home-username">{displayName}</div>
            <div className="home-goals-section">
              <span className="home-goals-label">나의 목표</span>
              {goals.length === 0 ? (
                <span className="home-goals-empty" onClick={() => navigate("/goals")}>
                  Set a Goal 💖
                </span>
              ) : (
                <div className="home-goals-chips">
                  {goals.map((g) => (
                    <span key={g.id ?? g.text} className="home-goal-chip">
                      <span className="home-goal-chip-type">
                        {GOAL_TYPE_LABELS[g.type] ?? g.type}
                      </span>
                      {g.text}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 이번달 목표 + Twinny 카드 ── */}
        <section className="home-middle">
          <div className="home-goal-card">
            <div className="home-goal-header">
              <span className="home-goal-title">전체 프로젝트 달성률</span>
              <span className="home-goal-percent">{progress}%</span>
            </div>
            <div className="home-progress-bar">
              <div className="home-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="home-goal-sub">
              {totalProjTasks === 0
                ? "진행 중인 프로젝트가 없어요!"
                : `완료 ${doneProjTasks}개 / 전체 ${totalProjTasks}개`}
            </div>
            <div className="home-goal-chips">
              <span className="home-chip chip-pink">개인 {personalProjects.length}개</span>
              <span className="home-chip chip-orange">그룹 {groupProjects.length}개</span>
              <span className="home-chip chip-green">완료 {doneProjTasks}개</span>
            </div>
          </div>

          {/* Twinny 카드 — 클릭하면 Twin Lab으로 이동 */}
          <button
            className="home-twinny-card"
            onClick={() => navigate("/twin-lab")}
            title="Go to Twin Lab"
          >
            <Twinny size={110} />
            <span className="home-twinny-name">Twinny</span>
            <p className="home-twinny-msg">{twinnyMsg}</p>
            <span className="home-twinny-cta">Goal · Self-care Twin 보기 →</span>
          </button>
        </section>

        {/* ── 메뉴 ── */}
        <section className="home-menu">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.label}
              className="home-menu-card"
              style={{ "--card-bg": item.color, "--card-border": item.border }}
              onClick={() => navigate(item.path)}
            >
              <span className="home-menu-icon">{item.icon}</span>
              <span className="home-menu-label">{item.label}</span>
              <span className="home-menu-desc">{item.desc}</span>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
