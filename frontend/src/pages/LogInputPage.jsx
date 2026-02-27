import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { logsApi } from "../api/client";

// ── MET 기반 운동 데이터베이스 ────────────────────────────────────────────────
// 칼로리 = MET × 체중(kg) × 시간(h)  / 강도 배율: 가볍게 0.75, 보통 1.0, 격렬 1.3
const EXERCISE_DB = [
  // 유산소
  { name: "걷기 (천천히)", category: "유산소", met: 2.5 },
  { name: "걷기 (빠르게)", category: "유산소", met: 4.3 },
  { name: "달리기 (가볍게)", category: "유산소", met: 8.0 },
  { name: "달리기 (보통)", category: "유산소", met: 11.0 },
  { name: "달리기 (빠르게)", category: "유산소", met: 14.0 },
  { name: "자전거 (실내)", category: "유산소", met: 7.0 },
  { name: "자전거 (야외, 가볍게)", category: "유산소", met: 6.0 },
  { name: "자전거 (야외, 빠르게)", category: "유산소", met: 10.0 },
  { name: "수영 (가볍게)", category: "유산소", met: 5.8 },
  { name: "수영 (보통)", category: "유산소", met: 8.3 },
  { name: "줄넘기", category: "유산소", met: 11.8 },
  { name: "등산", category: "유산소", met: 7.3 },
  { name: "계단 오르기", category: "유산소", met: 8.0 },
  { name: "인라인스케이트", category: "유산소", met: 9.8 },
  { name: "스케이팅", category: "유산소", met: 7.0 },
  { name: "에어로빅", category: "유산소", met: 7.3 },
  { name: "스텝 에어로빅", category: "유산소", met: 9.5 },
  // 근력/홈트
  { name: "헬스 (웨이트트레이닝)", category: "근력", met: 6.0 },
  { name: "스쿼트", category: "근력", met: 5.0 },
  { name: "데드리프트", category: "근력", met: 6.0 },
  { name: "푸시업", category: "근력", met: 3.8 },
  { name: "플랭크", category: "근력", met: 3.0 },
  { name: "런지", category: "근력", met: 4.0 },
  { name: "버피", category: "근력", met: 8.0 },
  { name: "HIIT (고강도인터벌)", category: "근력", met: 12.3 },
  { name: "크로스핏", category: "근력", met: 13.0 },
  { name: "케틀벨", category: "근력", met: 8.2 },
  { name: "TRX", category: "근력", met: 6.5 },
  // 유연성/마음챙김
  { name: "요가", category: "유연성", met: 2.5 },
  { name: "필라테스", category: "유연성", met: 3.0 },
  { name: "스트레칭", category: "유연성", met: 2.3 },
  // 구기종목
  { name: "축구", category: "구기", met: 7.0 },
  { name: "농구", category: "구기", met: 6.5 },
  { name: "배드민턴", category: "구기", met: 5.5 },
  { name: "테니스", category: "구기", met: 7.3 },
  { name: "탁구", category: "구기", met: 4.0 },
  { name: "배구", category: "구기", met: 3.5 },
  { name: "야구/소프트볼", category: "구기", met: 5.0 },
  { name: "골프", category: "구기", met: 4.3 },
  { name: "볼링", category: "구기", met: 3.0 },
  // 격투/댄스
  { name: "복싱", category: "격투/댄스", met: 9.8 },
  { name: "킥복싱", category: "격투/댄스", met: 10.3 },
  { name: "태권도", category: "격투/댄스", met: 7.8 },
  { name: "댄스 (가볍게)", category: "격투/댄스", met: 4.8 },
  { name: "댄스 (격렬하게)", category: "격투/댄스", met: 7.8 },
  { name: "줌바", category: "격투/댄스", met: 7.5 },
  // 기구
  { name: "러닝머신", category: "기구", met: 7.0 },
  { name: "일립티컬 머신", category: "기구", met: 5.0 },
  { name: "로잉머신", category: "기구", met: 7.0 },
  { name: "사이클 머신", category: "기구", met: 7.0 },
];

const INTENSITY_OPTIONS = [
  { value: "light",    label: "가볍게",    mult: 0.75 },
  { value: "moderate", label: "보통",      mult: 1.0  },
  { value: "intense",  label: "격렬하게",  mult: 1.3  },
];

const DEFAULT_WEIGHT = 65; // kg (기본값)

function calcCalories(met, durationMin, intensityMult, weight) {
  return Math.round(met * intensityMult * weight * (durationMin / 60));
}

// ── 로그 탭 정의 ──────────────────────────────────────────────────────────────
const LOG_TABS = [
  {
    key: "sleep",
    label: "수면",
    icon: "😴",
    color: "#c7d2fe",
    fields: [
      { name: "value", label: "수면 시간 (시간)", type: "number", min: 0, max: 24, step: 0.5, required: true },
      { name: "quality", label: "수면 질 (1~5)", type: "range", min: 1, max: 5, step: 1 },
    ],
  },
  {
    key: "study",
    label: "학습",
    icon: "📚",
    color: "#bbf7d0",
    fields: [
      { name: "value", label: "공부 시간 (시간)", type: "number", min: 0, max: 16, step: 0.5, required: true },
      { name: "concentration", label: "집중도 (1~5)", type: "range", min: 1, max: 5, step: 1 },
      { name: "subject", label: "과목/주제", type: "text" },
    ],
  },
  {
    key: "health",
    label: "운동",
    icon: "🏃",
    color: "#fde68a",
    fields: [], // 커스텀 UI
  },
  {
    key: "mood",
    label: "감정",
    icon: "😊",
    color: "#ffd6e0",
    fields: [
      { name: "value", label: "감정 점수 (1~5)", type: "range", min: 1, max: 5, step: 1 },
      { name: "emotion_type", label: "감정 유형", type: "select", options: ["행복", "평온", "피곤", "불안", "슬픔", "화남", "기대"] },
    ],
  },
];

const MOOD_EMOJIS = ["", "😞", "😕", "😐", "🙂", "😄"];
const QUALITY_LABELS = ["", "나쁨", "보통", "좋음", "좋음+", "최고"];

export default function LogInputPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("sleep");
  const [form, setForm] = useState({});
  const [todayLogs, setTodayLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // 운동 탭 전용 state
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [exerciseDuration, setExerciseDuration] = useState(30);
  const [exerciseIntensity, setExerciseIntensity] = useState("moderate");
  const [exerciseNote, setExerciseNote] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [bodyWeight, setBodyWeight] = useState(() => {
    const saved = localStorage.getItem("twin-time-body-weight");
    return saved ? parseFloat(saved) : DEFAULT_WEIGHT;
  });

  const tab = LOG_TABS.find((t) => t.key === activeTab);

  // 운동 검색 결과
  const searchResults = useMemo(() => {
    if (!exerciseSearch.trim()) return [];
    const q = exerciseSearch.toLowerCase();
    return EXERCISE_DB.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8);
  }, [exerciseSearch]);

  // 칼로리 계산
  const calories = useMemo(() => {
    if (!selectedExercise || !exerciseDuration) return 0;
    const mult = INTENSITY_OPTIONS.find((i) => i.value === exerciseIntensity)?.mult ?? 1;
    return calcCalories(selectedExercise.met, exerciseDuration, mult, bodyWeight);
  }, [selectedExercise, exerciseDuration, exerciseIntensity, bodyWeight]);

  useEffect(() => {
    if (activeTab !== "health") {
      const defaults = {};
      tab.fields.forEach((f) => {
        if (f.type === "range") defaults[f.name] = Math.ceil((f.min + f.max) / 2);
        else if (f.type === "checkbox" || f.type === "checkbox_value") defaults[f.name] = false;
        else defaults[f.name] = "";
      });
      setForm(defaults);
    } else {
      setExerciseSearch("");
      setSelectedExercise(null);
      setExerciseDuration(30);
      setExerciseIntensity("moderate");
      setExerciseNote("");
      setShowDropdown(false);
    }
    setError(null);
    setSuccess(null);
    loadTodayLogs(activeTab);
  }, [activeTab]);

  async function loadTodayLogs(logType) {
    try {
      const today = new Date().toISOString().split("T")[0];
      const logs = await logsApi.list({ type: logType, date_from: today, date_to: today });
      setTodayLogs(logs);
    } catch {
      setTodayLogs([]);
    }
  }

  function handleFieldChange(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleWeightChange(val) {
    const w = parseFloat(val);
    if (!isNaN(w) && w > 0) {
      setBodyWeight(w);
      localStorage.setItem("twin-time-body-weight", String(w));
    }
  }

  function selectExercise(ex) {
    setSelectedExercise(ex);
    setExerciseSearch(ex.name);
    setShowDropdown(false);
  }

  async function handleExerciseSubmit(e) {
    e.preventDefault();
    if (!selectedExercise) { setError("운동 종류를 검색해서 선택해주세요."); return; }
    if (!exerciseDuration || exerciseDuration <= 0) { setError("운동 시간을 입력해주세요."); return; }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const meta = JSON.stringify({
        has_exercise: true,
        exercise_name: selectedExercise.name,
        exercise_category: selectedExercise.category,
        met: selectedExercise.met,
        duration_min: exerciseDuration,
        intensity: exerciseIntensity,
        calories,
        body_weight: bodyWeight,
      });
      await logsApi.create("health", 1, meta, exerciseNote || null);
      setSuccess(`${selectedExercise.name} ${exerciseDuration}분 — 약 ${calories} kcal 소모! ✅`);
      setSelectedExercise(null);
      setExerciseSearch("");
      setExerciseDuration(30);
      setExerciseIntensity("moderate");
      setExerciseNote("");
      await loadTodayLogs("health");
    } catch (err) {
      setError(err.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      let rawValue;
      if (activeTab === "mood") {
        rawValue = parseFloat(form.value) || 3;
      } else {
        rawValue = parseFloat(form.value);
        if (isNaN(rawValue) || rawValue < 0) {
          setError("올바른 값을 입력해주세요.");
          setSaving(false);
          return;
        }
      }
      const meta = {};
      tab.fields.forEach((f) => {
        if (f.name === "value") return;
        const val = form[f.name];
        if (val !== "" && val !== undefined && val !== null) {
          meta[f.name] = f.type === "checkbox" ? !!val : val;
        }
      });
      await logsApi.create(
        activeTab,
        rawValue,
        Object.keys(meta).length > 0 ? JSON.stringify(meta) : null,
        form.note || null,
      );
      setSuccess("기록이 저장되었습니다! ✅");
      await loadTodayLogs(activeTab);
    } catch (err) {
      setError(err.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLog(id) {
    try {
      await logsApi.delete(id);
      setTodayLogs((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setError("삭제 실패: " + err.message);
    }
  }

  function getLogDisplay(log) {
    if (log.type === "health") {
      try {
        const m = JSON.parse(log.meta || "{}");
        if (m.exercise_name) {
          return `${m.exercise_name} ${m.duration_min}분 · ${m.calories ?? "?"}kcal`;
        }
      } catch {}
      return log.value === 1 ? "운동 완료 ✅" : "운동 없음";
    }
    if (log.type === "mood") return `${MOOD_EMOJIS[Math.round(log.value)] || ""} ${log.value}점`;
    if (log.type === "sleep" || log.type === "study") return `${log.value}시간`;
    return String(log.value);
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          ← 뒤로
        </button>
        <span className="app-header-logo">오늘의 기록</span>
        <div style={{ width: 60 }} />
      </header>

      <div className="log-input-main">
        {/* ── 탭 ── */}
        <div className="log-tabs">
          {LOG_TABS.map((t) => (
            <button
              key={t.key}
              className={`log-tab ${activeTab === t.key ? "active" : ""}`}
              style={{ "--tab-color": t.color }}
              onClick={() => setActiveTab(t.key)}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── 운동 탭 커스텀 UI ── */}
        {activeTab === "health" ? (
          <form className="log-form" onSubmit={handleExerciseSubmit} noValidate>
            {error && <div className="error-banner">{error}</div>}
            {success && <div className="success-banner">{success}</div>}

            {/* 체중 설정 */}
            <div className="log-field">
              <label className="log-field-label">내 체중 (kg) — 칼로리 계산에 사용</label>
              <input
                type="number"
                className="log-input"
                min={30} max={200} step={0.5}
                value={bodyWeight}
                onChange={(e) => handleWeightChange(e.target.value)}
              />
            </div>

            {/* 운동 검색 */}
            <div className="log-field" style={{ position: "relative" }}>
              <label className="log-field-label">운동 검색</label>
              <input
                type="text"
                className="log-input"
                placeholder="예: 달리기, 수영, 헬스, 요가..."
                value={exerciseSearch}
                onChange={(e) => {
                  setExerciseSearch(e.target.value);
                  setSelectedExercise(null);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
              />
              {showDropdown && searchResults.length > 0 && (
                <div className="exercise-dropdown">
                  {searchResults.map((ex) => (
                    <button
                      key={ex.name}
                      type="button"
                      className="exercise-dropdown-item"
                      onClick={() => selectExercise(ex)}
                    >
                      <span className="exercise-item-name">{ex.name}</span>
                      <span className="exercise-item-cat">{ex.category} · MET {ex.met}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedExercise && (
                <div className="exercise-selected-badge">
                  ✅ {selectedExercise.name} 선택됨
                </div>
              )}
            </div>

            {/* 운동 시간 */}
            <div className="log-field">
              <label className="log-field-label">운동 시간 (분)</label>
              <input
                type="number"
                className="log-input"
                min={1} max={360} step={5}
                value={exerciseDuration}
                onChange={(e) => setExerciseDuration(parseInt(e.target.value) || 0)}
              />
            </div>

            {/* 운동 강도 */}
            <div className="log-field">
              <label className="log-field-label">운동 강도</label>
              <div className="exercise-intensity-row">
                {INTENSITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`exercise-intensity-btn ${exerciseIntensity === opt.value ? "active" : ""}`}
                    onClick={() => setExerciseIntensity(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 칼로리 표시 */}
            {selectedExercise && exerciseDuration > 0 && (
              <div className="exercise-calorie-card">
                <div className="exercise-calorie-icon">🔥</div>
                <div className="exercise-calorie-info">
                  <div className="exercise-calorie-value">{calories} <span>kcal</span></div>
                  <div className="exercise-calorie-detail">
                    {selectedExercise.name} · {exerciseDuration}분 · {INTENSITY_OPTIONS.find(i => i.value === exerciseIntensity)?.label}
                  </div>
                </div>
              </div>
            )}

            {/* 메모 */}
            <div className="log-field">
              <label className="log-field-label">메모 (선택)</label>
              <textarea
                className="log-input log-textarea"
                rows={2}
                value={exerciseNote}
                onChange={(e) => setExerciseNote(e.target.value)}
                placeholder="오늘의 운동 느낌을 기록해보세요..."
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary log-submit-btn"
              disabled={saving}
              style={{ background: "#fde68a", color: "#5c3a4a" }}
            >
              {saving ? "저장 중..." : "🏃 운동 기록 저장"}
            </button>
          </form>
        ) : (
          /* ── 일반 탭 폼 ── */
          <form className="log-form" onSubmit={handleSubmit} noValidate>
            {error && <div className="error-banner">{error}</div>}
            {success && <div className="success-banner">{success}</div>}

            {tab.fields.map((field) => (
              <div key={field.name} className="log-field">
                <label className="log-field-label">{field.label}</label>

                {field.type === "number" && (
                  <input
                    type="number"
                    className="log-input"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={form[field.name] ?? ""}
                    required={field.required}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  />
                )}

                {field.type === "range" && (
                  <div className="log-range-wrap">
                    <input
                      type="range"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={form[field.name] ?? Math.ceil((field.min + field.max) / 2)}
                      onChange={(e) => handleFieldChange(field.name, parseInt(e.target.value))}
                      className="sim-range-input"
                      style={{ "--range-pct": `${((form[field.name] - field.min) / (field.max - field.min)) * 100}%`, "--range-color": tab.color }}
                    />
                    <span className="log-range-display">
                      {field.name === "value"
                        ? MOOD_EMOJIS[form[field.name]] || form[field.name]
                        : field.name === "quality"
                        ? QUALITY_LABELS[form[field.name]] || form[field.name]
                        : form[field.name]}
                      {" "}({form[field.name] ?? ""})
                    </span>
                  </div>
                )}

                {field.type === "text" && (
                  <input
                    type="text"
                    className="log-input"
                    placeholder={field.placeholder || ""}
                    value={form[field.name] ?? ""}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  />
                )}

                {field.type === "select" && (
                  <select
                    className="log-input"
                    value={form[field.name] ?? ""}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  >
                    <option value="">선택...</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}

                {(field.type === "checkbox" || field.type === "checkbox_value") && (
                  <label className="log-checkbox-label">
                    <input
                      type="checkbox"
                      checked={!!form[field.name]}
                      onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                    />
                    {field.checkLabel}
                  </label>
                )}
              </div>
            ))}

            <div className="log-field">
              <label className="log-field-label">메모 (선택)</label>
              <textarea
                className="log-input log-textarea"
                rows={2}
                value={form.note ?? ""}
                onChange={(e) => handleFieldChange("note", e.target.value)}
                placeholder="오늘의 컨디션이나 특이사항을 남겨보세요..."
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary log-submit-btn"
              disabled={saving}
              style={{ background: tab.color, color: "#5c3a4a" }}
            >
              {saving ? "저장 중..." : `${tab.icon} ${tab.label} 기록 저장`}
            </button>
          </form>
        )}

        {/* ── 오늘 기록 목록 ── */}
        {todayLogs.length > 0 && (
          <div className="log-today-section">
            <h4 className="log-today-title">오늘의 {tab.label} 기록</h4>
            <div className="log-today-list">
              {todayLogs.map((log) => (
                <div key={log.id} className="log-today-item">
                  <div className="log-today-info">
                    <span className="log-today-value">{getLogDisplay(log)}</span>
                    <span className="log-today-time">
                      {new Date(log.timestamp + (log.timestamp.includes("Z") ? "" : "Z"))
                        .toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {log.note && <span className="log-today-note">{log.note}</span>}
                  </div>
                  <button
                    className="log-today-delete"
                    onClick={() => handleDeleteLog(log.id)}
                    title="삭제"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
