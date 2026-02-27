import { useState, useEffect } from "react";
import { apiFetch, friendsApi, taskCommentsApi } from "../api/client";

const CATEGORIES = ["general", "work", "personal", "health", "study"];
const STATUSES = ["planned", "in_progress", "done"];
const STATUS_LABELS = { planned: "예정", in_progress: "진행중", done: "완료" };
const CATEGORY_LABELS = {
  general: "일반", work: "업무", personal: "개인", health: "건강", study: "학습",
};
const VISIBILITY_LABELS = {
  private: "비밀 (나만 보기)",
  public: "전체공개 (친구 모두)",
  selective: "일부공개 (선택된 친구)",
};

function toLocalInputValue(dt) {
  if (!dt) return "";
  const normalized = /[Z+]/.test(dt) ? dt : dt + "Z";
  const d = new Date(normalized);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function defaultStart(date) {
  const d = new Date(date); d.setHours(9, 0, 0, 0); return toLocalInputValue(d);
}
function defaultEnd(date) {
  const d = new Date(date); d.setHours(10, 0, 0, 0); return toLocalInputValue(d);
}
function formatCommentTime(dt) {
  const d = new Date(dt + "Z");
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}시간 전`;
  return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

export default function TaskModal({ task, defaultDate, onClose, onSave }) {
  const isEdit = Boolean(task?.id);

  const [form, setForm] = useState({
    title: task?.title || "",
    category: task?.category || "general",
    start_at: task ? toLocalInputValue(task.start_at) : defaultStart(defaultDate),
    end_at: task ? toLocalInputValue(task.end_at) : defaultEnd(defaultDate),
    expected_min: task?.expected_min ?? 60,
    status: task?.status || "planned",
    visibility: task?.visibility || "private",
    visible_to_user_ids: [],
  });
  const [participantIds, setParticipantIds] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState([]);

  // 댓글 상태
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState(null); // { id, nickname }
  const [myUserId, setMyUserId] = useState(null);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  useEffect(() => {
    friendsApi.list().then(setFriends).catch(() => {});
    apiFetch("/auth/me").then(u => setMyUserId(u.id)).catch(() => {});
    if (isEdit) loadComments();
  }, []);

  const loadComments = async () => {
    try {
      const data = await taskCommentsApi.list(task.id);
      setComments(data);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) { setError("제목을 입력해주세요."); return; }
    if (!form.start_at || !form.end_at) { setError("시작/종료 시간을 입력해주세요."); return; }
    if (new Date(form.start_at) >= new Date(form.end_at)) {
      setError("종료 시간은 시작 시간보다 늦어야 합니다."); return;
    }
    setLoading(true);
    try {
      const base = {
        ...form,
        expected_min: Number(form.expected_min),
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
      };
      if (isEdit) {
        await apiFetch(`/tasks/${task.id}`, { method: "PUT", body: JSON.stringify(base) });
      } else {
        await apiFetch("/tasks", {
          method: "POST",
          body: JSON.stringify({ ...base, participant_ids: participantIds }),
        });
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("이 일정을 삭제하시겠습니까?")) return;
    setLoading(true);
    try {
      await apiFetch(`/tasks/${task.id}`, { method: "DELETE" });
      onSave(); onClose();
    } catch (err) {
      setError(err.message); setLoading(false);
    }
  };

  const toggleFriend = (userId) => {
    set("visible_to_user_ids",
      form.visible_to_user_ids.includes(userId)
        ? form.visible_to_user_ids.filter(id => id !== userId)
        : [...form.visible_to_user_ids, userId]
    );
  };

  const toggleParticipant = (userId) => {
    setParticipantIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      await taskCommentsApi.create(task.id, commentText.trim(), replyTo?.id ?? null);
      setCommentText("");
      setReplyTo(null);
      await loadComments();
    } catch {}
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await taskCommentsApi.delete(task.id, commentId);
      await loadComments();
    } catch {}
  };

  // 댓글 트리 구성 (최상위 + 대댓글)
  const topComments = comments.filter(c => !c.parent_id);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card modal-card-wide">
        <h2 className="modal-title">{isEdit ? "일정 수정" : "새 일정 추가"}</h2>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">제목</label>
            <input
              className="form-input" type="text"
              placeholder="일정 제목을 입력하세요"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">카테고리</label>
              <select className="form-select" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">상태</label>
              <select className="form-select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">시작 시간</label>
              <input className="form-input" type="datetime-local" value={form.start_at}
                onChange={(e) => set("start_at", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">종료 시간</label>
              <input className="form-input" type="datetime-local" value={form.end_at}
                onChange={(e) => set("end_at", e.target.value)} />
            </div>
          </div>

          {/* 공개 범위 */}
          <div className="form-group">
            <label className="form-label">공개 범위</label>
            <select
              className="form-select" value={form.visibility}
              onChange={(e) => { set("visibility", e.target.value); set("visible_to_user_ids", []); }}
            >
              {Object.entries(VISIBILITY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {form.visibility === "selective" && (
            <div className="form-group">
              <label className="form-label">공개할 친구 선택</label>
              {friends.length === 0 ? (
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>친구를 먼저 추가해주세요</div>
              ) : (
                <div className="friend-select-list">
                  {friends.map(f => (
                    <label key={f.id} className="friend-select-item">
                      <input type="checkbox"
                        checked={form.visible_to_user_ids.includes(f.user.id)}
                        onChange={() => toggleFriend(f.user.id)}
                      />
                      {f.user.nickname ?? `User #${f.user.id}`}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 함께 하기 (새 일정 생성 시만) */}
          {!isEdit && friends.length > 0 && (
            <div className="form-group">
              <label className="form-label">함께 할 친구 <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "var(--text-muted)" }}>— 선택 시 친구 캘린더에도 일정이 생성됩니다</span></label>
              <div className="friend-select-list">
                {friends.map(f => (
                  <label key={f.id} className="friend-select-item">
                    <input type="checkbox"
                      checked={participantIds.includes(f.user.id)}
                      onChange={() => toggleParticipant(f.user.id)}
                    />
                    {f.user.nickname ?? `User #${f.user.id}`}
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="error-msg" style={{ marginBottom: "1rem" }}>{error}</p>}

          <div className="modal-actions">
            {isEdit && (
              <button type="button" className="btn btn-danger" style={{ marginRight: "auto" }}
                onClick={handleDelete} disabled={loading}>삭제</button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "저장 중…" : isEdit ? "수정" : "추가"}
            </button>
          </div>
        </form>

        {/* ── 댓글 섹션 (수정 모드만) ── */}
        {isEdit && (
          <div className="task-comments-section">
            <div className="task-comments-title">💬 댓글 {comments.length > 0 && `(${comments.length})`}</div>

            {topComments.length === 0 && (
              <div className="task-comments-empty">첫 댓글을 남겨보세요!</div>
            )}

            {topComments.map(comment => {
              const replies = comments.filter(r => r.parent_id === comment.id);
              return (
                <div key={comment.id} className="comment-thread">
                  <div className="comment-item">
                    <div className="comment-header">
                      <span className="comment-nick">{comment.nickname ?? "익명"}</span>
                      <span className="comment-time">{formatCommentTime(comment.created_at)}</span>
                      {myUserId === comment.user_id && (
                        <button className="comment-delete-btn" onClick={() => handleDeleteComment(comment.id)}>✕</button>
                      )}
                    </div>
                    <div className="comment-content">{comment.content}</div>
                    <button
                      className="comment-reply-btn"
                      onClick={() => setReplyTo(replyTo?.id === comment.id ? null : { id: comment.id, nickname: comment.nickname })}
                    >
                      {replyTo?.id === comment.id ? "취소" : "↩ 답글"}
                    </button>
                  </div>

                  {replies.map(reply => (
                    <div key={reply.id} className="comment-item comment-reply">
                      <div className="comment-header">
                        <span className="comment-nick">{reply.nickname ?? "익명"}</span>
                        <span className="comment-time">{formatCommentTime(reply.created_at)}</span>
                        {myUserId === reply.user_id && (
                          <button className="comment-delete-btn" onClick={() => handleDeleteComment(reply.id)}>✕</button>
                        )}
                      </div>
                      <div className="comment-content">{reply.content}</div>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* 댓글 입력 */}
            <div className="comment-input-area">
              {replyTo && (
                <div className="comment-reply-target">
                  ↩ <strong>{replyTo.nickname}</strong> 님에게 답글
                  <button className="comment-reply-cancel" onClick={() => setReplyTo(null)}>✕</button>
                </div>
              )}
              <div className="comment-input-row">
                <input
                  className="comment-input"
                  type="text"
                  placeholder={replyTo ? "답글을 입력하세요..." : "댓글을 입력하세요..."}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                />
                <button className="btn btn-primary btn-sm" onClick={handleAddComment}>등록</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
