import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiRegister, apiFetch } from "../api/client";

export default function RegisterPage() {
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [nickname, setNickname]       = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const navigate = useNavigate();

  async function checkNicknameDuplicate(value) {
    const trimmed = value.trim();
    if (!trimmed) { setNicknameError(""); return; }
    try {
      const res = await apiFetch(`/auth/nickname-check?nickname=${encodeURIComponent(trimmed)}`);
      if (res.duplicate) {
        setNicknameError("중복된 닉네임입니다!");
      } else {
        setNicknameError("");
      }
    } catch {
      setNicknameError("");
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (nicknameError) return;
    setError("");
    setLoading(true);
    try {
      await apiRegister(email, password, nickname.trim() || undefined);
      navigate("/login");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">

        {/* 왼쪽 패널 */}
        <div className="auth-left">
          <div className="auth-left-icon">🐱</div>
          <h1 className="auth-left-title">Twin Time</h1>
          <p className="auth-left-desc">
            지금 바로 시작해서<br />나만의 시간을 관리해보세요
          </p>
        </div>

        {/* 오른쪽 폼 */}
        <div className="auth-right">
          <h2 className="auth-form-title">회원가입</h2>
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field-wrap">
              <label className="field-label">이메일</label>
              <input
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field-wrap">
              <label className="field-label">비밀번호</label>
              <input
                type="password"
                placeholder="사용할 비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="field-wrap">
              <label className="field-label">닉네임 <span style={{ fontWeight: 400, color: "#aaa" }}>(선택)</span></label>
              <input
                type="text"
                placeholder="친구 검색에 사용될 닉네임"
                value={nickname}
                onChange={(e) => { setNickname(e.target.value); setNicknameError(""); }}
                onBlur={(e) => checkNicknameDuplicate(e.target.value)}
                maxLength={30}
              />
              {nicknameError && <p className="error-msg" style={{ marginTop: "0.25rem" }}>{nicknameError}</p>}
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" disabled={loading || !!nicknameError}>
              {loading ? "가입 중…" : "회원가입"}
            </button>
          </form>
          <p className="auth-link">
            이미 계정이 있으신가요? <Link to="/login">로그인</Link>
          </p>
        </div>

      </div>
    </div>
  );
}
