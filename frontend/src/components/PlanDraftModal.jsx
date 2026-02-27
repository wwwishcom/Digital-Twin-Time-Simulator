/**
 * PlanDraftModal — 캘린더 초안 편집 및 적용 모달
 *
 * Props:
 *   changes        : 시뮬레이션 변화량 dict
 *   horizonDays    : 기간 (7 or 30)
 *   existingDraftId: 기존 초안 ID (null이면 새로 생성)
 *   onClose        : 모달 닫기
 *   onApplied      : 캘린더 적용 완료 후 콜백
 */
import { useState, useEffect } from "react";
import { planApi } from "../api/client";

export default function PlanDraftModal({ changes, horizonDays, existingDraftId, onClose, onApplied }) {
  const [draft, setDraft] = useState(null);
  const [events, setEvents] = useState([]);
  const [planName, setPlanName] = useState("내 Twin 루틴");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (existingDraftId) {
      loadExistingDraft(existingDraftId);
    } else {
      createNewDraft();
    }
  }, []);

  async function createNewDraft() {
    setLoading(true);
    setError(null);
    try {
      const d = await planApi.createDraft(planName, changes, horizonDays);
      setDraft(d);
      setEvents(d.events || []);
    } catch (e) {
      setError("초안 생성에 실패했습니다: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadExistingDraft(id) {
    setLoading(true);
    try {
      const d = await planApi.getDraft(id);
      setDraft(d);
      setEvents(d.events || []);
    } catch (e) {
      setError("초안 로드에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function updateEvent(index, field, value) {
    setEvents((prev) =>
      prev.map((ev, i) => (i === index ? { ...ev, [field]: value } : ev))
    );
  }

  function removeEvent(index) {
    setEvents((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      await planApi.updateDraft(draft.id, events);
    } catch (e) {
      setError("저장 실패: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleApply() {
    if (!draft) return;
    setApplying(true);
    setError(null);
    try {
      // 먼저 편집 내용 저장
      await planApi.updateDraft(draft.id, events);
      // 캘린더에 적용
      const res = await planApi.applyDraft(draft.id);
      alert(`${res.task_count}개의 일정이 캘린더에 추가되었습니다! 🎉`);
      onApplied && onApplied();
    } catch (e) {
      setError("적용 실패: " + e.message);
    } finally {
      setApplying(false);
    }
  }

  const formatDatetime = (iso) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="plan-draft-modal">
        <div className="plan-draft-header">
          <h3 className="plan-draft-title">📅 캘린더 초안</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {loading ? (
          <div className="plan-draft-loading">일정 초안을 생성하는 중...</div>
        ) : (
          <>
            <div className="plan-draft-meta">
              <label className="plan-draft-meta-label">플랜 이름</label>
              <input
                className="plan-draft-name-input"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
              />
              <span className="plan-draft-count">{events.length}개 일정</span>
            </div>

            <div className="plan-draft-events">
              {events.length === 0 ? (
                <div className="plan-draft-empty">
                  생성된 일정이 없습니다. 슬라이더를 조정해서 변화량을 입력해주세요.
                </div>
              ) : (
                events.map((ev, i) => (
                  <div key={i} className="plan-event-row">
                    <div className="plan-event-main">
                      <input
                        className="plan-event-title-input"
                        value={ev.title}
                        onChange={(e) => updateEvent(i, "title", e.target.value)}
                      />
                      <div className="plan-event-times">
                        <input
                          type="datetime-local"
                          className="plan-event-time-input"
                          value={formatDatetime(ev.start_at)}
                          onChange={(e) => updateEvent(i, "start_at", e.target.value)}
                        />
                        <span>~</span>
                        <input
                          type="datetime-local"
                          className="plan-event-time-input"
                          value={formatDatetime(ev.end_at)}
                          onChange={(e) => updateEvent(i, "end_at", e.target.value)}
                        />
                      </div>
                      <select
                        className="plan-event-category"
                        value={ev.category || "general"}
                        onChange={(e) => updateEvent(i, "category", e.target.value)}
                      >
                        <option value="general">일반</option>
                        <option value="study">공부</option>
                        <option value="health">건강</option>
                        <option value="finance">소비</option>
                      </select>
                    </div>
                    <button
                      className="plan-event-remove"
                      onClick={() => removeEvent(i)}
                      title="삭제"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="plan-draft-footer">
              <button className="btn btn-ghost" onClick={handleSave} disabled={saving}>
                {saving ? "저장 중..." : "💾 초안 저장"}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleApply}
                disabled={applying || events.length === 0}
              >
                {applying ? "적용 중..." : "📅 캘린더에 적용"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
