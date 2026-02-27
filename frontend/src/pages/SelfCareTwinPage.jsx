import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logsApi, friendsLogsApi, friendsApi } from "../api/client";

// 오늘 날짜 (YYYY-MM-DD)
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SECTION_KEYS = ["sleep", "health", "mood"];
const SECTION_META = {
  sleep:  { label: "수면",  icon: "😴", unit: "시간", color: "#c7d2fe" },
  health: { label: "운동",  icon: "🏃", unit: "회",   color: "#bbf7d0" },
  mood:   { label: "감정",  icon: "😊", unit: "점",   color: "#fde68a" },
};

const MOOD_LABELS = { 1: "😞", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };

function formatDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getNickname(email) {
  if (!email) return "사용자";
  if (email.includes("@")) return email.split("@")[0];
  return email;
}

// 프라이버시 토글 (localStorage 기반)
function usePrivacy(key) {
  const storageKey = `sct-privacy-${key}`;
  const [shared, setShared] = useState(() => {
    try { return localStorage.getItem(storageKey) !== "false"; }
    catch { return true; }
  });
  const toggle = () => setShared((v) => {
    const next = !v;
    localStorage.setItem(storageKey, String(next));
    return next;
  });
  return [shared, toggle];
}

// 섹션 값 요약
function summarizeMyLogs(logs, type) {
  const todayLogs = logs.filter((l) => l.type === type);
  if (todayLogs.length === 0) return null;
  const total = todayLogs.reduce((s, l) => s + (l.value || 0), 0);
  const avg = total / todayLogs.length;
  return { total, avg, count: todayLogs.length };
}

function MySection({ type, logs }) {
  const meta = SECTION_META[type];
  const summary = summarizeMyLogs(logs, type);
  const todayLogs = logs.filter((l) => l.type === type);

  return (
    <div className="sct-section">
      <div className="sct-section-icon">{meta.icon}</div>
      <div className="sct-section-body">
        <div className="sct-section-label">{meta.label}</div>
        {summary ? (
          <>
            <div className="sct-section-value" style={{ color: "var(--accent)" }}>
              {type === "mood"
                ? `${MOOD_LABELS[Math.round(summary.avg)] || ""} ${summary.avg.toFixed(1)}${meta.unit}`
                : `${summary.total.toFixed(1)}${meta.unit}`}
            </div>
            <div className="sct-log-list">
              {todayLogs.map((log) => (
                <span key={log.id} className="sct-log-chip">
                  {type === "mood" ? `${MOOD_LABELS[log.value] || ""} ${log.value}` : `${log.value}${meta.unit}`}
                  <span className="sct-log-time">{formatDate(log.timestamp)}</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="sct-section-empty">오늘 기록 없음</div>
        )}
      </div>
    </div>
  );
}

function FriendSection({ type, friendsData, friends, shared }) {
  if (!shared) {
    return (
      <div className="sct-friend-section sct-private">
        <span className="sct-lock-icon">🔒</span>
        <span>비공개 설정됨</span>
      </div>
    );
  }

  if (!friendsData || friendsData.length === 0) {
    return (
      <div className="sct-friend-section sct-no-friends">
        친구 기록 없음
      </div>
    );
  }

  const meta = SECTION_META[type];
  // 친구별로 그룹화
  const byFriend = {};
  for (const log of friendsData.filter((l) => l.type === type)) {
    if (!byFriend[log.user_id]) byFriend[log.user_id] = [];
    byFriend[log.user_id].push(log);
  }

  if (Object.keys(byFriend).length === 0) {
    return <div className="sct-friend-section sct-no-friends">친구 기록 없음</div>;
  }

  return (
    <div className="sct-friend-section">
      {Object.entries(byFriend).map(([userId, logs]) => {
        const friend = friends.find((f) => String(f.id) === String(userId));
        const nick = friend?.nickname || getNickname(friend?.email) || `사용자 ${userId}`;
        const total = logs.reduce((s, l) => s + (l.value || 0), 0);
        const avg = total / logs.length;
        return (
          <div key={userId} className="sct-friend-row">
            <span className="sct-friend-nick">{nick}</span>
            <span className="sct-friend-val">
              {type === "mood"
                ? `${MOOD_LABELS[Math.round(avg)] || ""} ${avg.toFixed(1)}`
                : `${total.toFixed(1)}${meta.unit}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function SelfCareTwinPage() {
  const navigate = useNavigate();
  const today = todayStr();

  const [myLogs, setMyLogs] = useState([]);
  const [friendsLogs, setFriendsLogs] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sleepShared, toggleSleep] = usePrivacy("sleep");
  const [healthShared, toggleHealth] = usePrivacy("health");
  const [moodShared, toggleMood] = usePrivacy("mood");
  const privacyMap = {
    sleep: [sleepShared, toggleSleep],
    health: [healthShared, toggleHealth],
    mood: [moodShared, toggleMood],
  };

  useEffect(() => {
    Promise.allSettled([
      logsApi.list({ date_from: today, date_to: today, limit: 200 }),
      friendsLogsApi.list({ types: SECTION_KEYS, log_date: today }),
      friendsApi.list(),
    ]).then(([myRes, friendsRes, friendListRes]) => {
      if (myRes.status === "fulfilled") setMyLogs(myRes.value || []);
      if (friendsRes.status === "fulfilled") setFriendsLogs(friendsRes.value || []);
      if (friendListRes.status === "fulfilled") setFriends(friendListRes.value || []);
    }).finally(() => setLoading(false));
  }, [today]);

  return (
    <div className="app-layout">
      <header className="app-header">
        <button className="btn btn-ghost" onClick={() => navigate("/twin-lab")}>
          ← Twin Lab
        </button>
        <span className="app-header-logo" style={{ fontSize: "1rem" }}>
          Self-care Twin
        </span>
        <button className="btn btn-ghost" onClick={() => navigate("/logs")}>
          기록 +
        </button>
      </header>

      <div className="sct-main">
        {loading ? (
          <div className="sct-loading">불러오는 중...</div>
        ) : (
          <>
            {/* 섹션별 카드 */}
            {SECTION_KEYS.map((type) => {
              const meta = SECTION_META[type];
              const [shared, toggle] = privacyMap[type];
              return (
                <div key={type} className="sct-card">
                  <div className="sct-card-header">
                    <span className="sct-card-title">
                      {meta.icon} {meta.label}
                    </span>
                    <button
                      className={`sct-privacy-btn ${shared ? "sct-privacy-on" : "sct-privacy-off"}`}
                      onClick={toggle}
                      title={shared ? "친구에게 공개 중" : "비공개"}
                    >
                      {shared ? "👥 공개" : "🔒 비공개"}
                    </button>
                  </div>

                  {/* 나의 기록 */}
                  <div className="sct-my-row">
                    <span className="sct-row-label">나</span>
                    <MySection type={type} logs={myLogs} />
                  </div>

                  {/* 친구 비교 */}
                  <div className="sct-friends-row">
                    <span className="sct-row-label">친구</span>
                    <FriendSection
                      type={type}
                      friendsData={friendsLogs}
                      friends={friends}
                      shared={shared}
                    />
                  </div>
                </div>
              );
            })}

            {/* Twin Wallet 진입 */}
            <button
              className="sct-wallet-btn"
              onClick={() => navigate("/twin-wallet")}
            >
              <span className="sct-wallet-icon">💰</span>
              <span>
                <strong>Twin Wallet</strong>
                <br />
                <small>소비 · 소득 · 투자 가계부</small>
              </span>
              <span className="sct-wallet-arrow">→</span>
            </button>

            {/* 기록 없을 때 안내 */}
            {myLogs.length === 0 && (
              <div className="sct-empty-hint">
                오늘의 기록을 남겨보세요!
                <button className="btn btn-primary" style={{ marginTop: "0.75rem" }} onClick={() => navigate("/logs")}>
                  기록하러 가기
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
