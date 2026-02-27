import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { goalsApi, setNickname as apiSetNickname } from "../api/client";

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

export default function EditPage() {
  const navigate = useNavigate();
  const { token, logout } = useAuth();

  const email = decodeEmail(token);
  const profileKey = `twin-time-profile-${email}`;

  const [profile, setProfile] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem(profileKey)) || {
          nickname: "",
          school: "",
          age: "",
          gender: "",
          profileImage: null,
        }
      );
    } catch {
      return { nickname: "", school: "", age: "", gender: "", profileImage: null };
    }
  });

  const [goals, setGoals] = useState([]);
  const [saved, setSaved] = useState(false);
  const [nicknameError, setNicknameError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    goalsApi.list().then(setGoals).catch(() => {});
  }, []);

  function compressImage(dataUrl, maxSize = 256, quality = 0.8) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = dataUrl;
    });
  }

  function saveProfile(next) {
    try {
      localStorage.setItem(profileKey, JSON.stringify(next));
    } catch {
      const { profileImage: _, ...rest } = next;
      localStorage.setItem(profileKey, JSON.stringify({ ...rest, profileImage: null }));
    }
    window.dispatchEvent(new CustomEvent("twintime-profile-update", { detail: next }));
    flashSaved();
  }

  function updateField(field, value) {
    const next = { ...profile, [field]: value };
    setProfile(next);
    if (field === "nickname") {
      // 닉네임은 API를 통해서만 DB에 저장 — localStorage만 임시 반영
      try { localStorage.setItem(profileKey, JSON.stringify(next)); } catch {
        const { profileImage: _, ...rest } = next;
        localStorage.setItem(profileKey, JSON.stringify({ ...rest, profileImage: null }));
      }
      window.dispatchEvent(new CustomEvent("twintime-profile-update", { detail: next }));
    } else {
      saveProfile(next);
    }
  }

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await compressImage(ev.target.result);
      updateField("profileImage", compressed);
    };
    reader.readAsDataURL(file);
  }

  async function handleNicknameBlur() {
    const nickname = profile.nickname.trim();
    if (!nickname) return;
    try {
      await apiSetNickname(nickname);
      setNicknameError("");
    } catch (err) {
      setNicknameError(err.message);
    }
  }

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function handleSave() {
    const nickname = profile.nickname.trim();
    if (nickname) {
      try {
        await apiSetNickname(nickname);
        setNicknameError("");
      } catch (err) {
        setNicknameError(err.message);
        return;
      }
    }
    saveProfile(profile);
    navigate("/");
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
        <div className="edit-card profile-edit-card">
          <div className="edit-card-header">
            <span className="edit-card-icon">👤</span>
            <h2 className="edit-card-title">프로필 편집</h2>
            {saved && <span className="edit-saved-badge">저장됨 ✓</span>}
          </div>

          {/* 프로필 이미지 */}
          <div className="profile-img-section">
            <div className="profile-img-wrap" onClick={() => fileRef.current?.click()}>
              {profile.profileImage ? (
                <img src={profile.profileImage} className="profile-img" alt="프로필" />
              ) : (
                <div className="profile-img-placeholder">
                  <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
                    <circle cx="21" cy="15" r="9" fill="#fbcfe8" />
                    <path d="M4 42c0-9.389 7.611-17 17-17s17 7.611 17 17" fill="#fbcfe8" />
                  </svg>
                </div>
              )}
              <div className="profile-img-overlay">변경</div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImageChange}
            />
          </div>

          {/* 프로필 필드 */}
          <div className="profile-fields">
            <div className="profile-field-row">
              <label className="profile-field-label">닉네임</label>
              <div style={{ flex: 1 }}>
                <input
                  className="edit-goal-input"
                  type="text"
                  placeholder="닉네임을 입력하세요 (친구 검색에 사용됩니다)"
                  value={profile.nickname}
                  onChange={(e) => {
                    setNicknameError("");
                    updateField("nickname", e.target.value);
                  }}
                  onBlur={handleNicknameBlur}
                  maxLength={30}
                  style={{ width: "100%" }}
                />
                {nicknameError && (
                  <span style={{ fontSize: "0.78rem", color: "#f87171" }}>{nicknameError}</span>
                )}
              </div>
            </div>
            <div className="profile-field-row">
              <label className="profile-field-label">학교</label>
              <input
                className="edit-goal-input"
                type="text"
                placeholder="학교를 입력하세요"
                value={profile.school}
                onChange={(e) => updateField("school", e.target.value)}
                maxLength={40}
              />
            </div>
            <div className="profile-fields-2col">
              <div className="profile-field-row">
                <label className="profile-field-label">나이</label>
                <input
                  className="edit-goal-input"
                  type="number"
                  placeholder="나이"
                  value={profile.age}
                  onChange={(e) => updateField("age", e.target.value)}
                  min={1}
                  max={120}
                />
              </div>
              <div className="profile-field-row">
                <label className="profile-field-label">성별</label>
                <select
                  className="edit-goal-input"
                  value={profile.gender}
                  onChange={(e) => updateField("gender", e.target.value)}
                >
                  <option value="">선택 안함</option>
                  <option value="여성">여성</option>
                  <option value="남성">남성</option>
                  <option value="기타">기타</option>
                </select>
              </div>
            </div>
          </div>

          {/* 목표 섹션 */}
          <div className="profile-goal-section">
            <div className="profile-goal-header">
              <span className="profile-goal-title">나의 목표</span>
              <button
                className="btn btn-ghost profile-goal-edit-btn"
                onClick={() => navigate("/goals")}
              >
                목표 수정
              </button>
            </div>
            {goals.length === 0 ? (
              <div
                className="edit-goals-empty"
                style={{ textAlign: "left", padding: "0.4rem 0" }}
              >
                아직 설정된 목표가 없어요.
              </div>
            ) : (
              <ul className="edit-goals-list">
                {goals.map((g) => (
                  <li key={g.id} className="edit-goal-item">
                    <span className="goal-type-badge">
                      {GOAL_TYPE_LABELS[g.type] ?? g.type}
                    </span>
                    <span className="edit-goal-text">{g.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button className="btn btn-ghost edit-back-btn" onClick={handleSave}>
            ← 홈으로 돌아가기
          </button>
          <button className="btn btn-primary edit-back-btn" onClick={handleSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
