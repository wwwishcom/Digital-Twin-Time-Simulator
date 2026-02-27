import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
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
            나만의 시간 패턴을<br />기록하고 분석하세요
          </p>
        </div>

        {/* 오른쪽 폼 */}
        <div className="auth-right">
          <h2 className="auth-form-title">로그인</h2>
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
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? "로그인 중…" : "로그인"}
            </button>
          </form>
          <p className="auth-link">
            계정이 없으신가요? <Link to="/register">회원가입</Link>
          </p>
        </div>

      </div>
    </div>
  );
}
