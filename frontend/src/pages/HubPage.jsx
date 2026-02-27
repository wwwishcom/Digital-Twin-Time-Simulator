import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { friendsApi, groupsApi, apiFetch, taskCommentsApi, groupGoalsApi, groupProjectsApi, groupStatsApi } from "../api/client";

const GOAL_TYPE_LABELS = {
  daily: "매일", weekly: "매주", monthly: "매월",
  "6months": "6개월 후", "1year": "1년 후",
};

const CATEGORY_COLORS = {
  general: "#a78bfa", work: "#60a5fa", personal: "#f472b6",
  health: "#34d399", study: "#fbbf24",
};

// 멤버별 색상 팔레트
const MEMBER_PALETTES = [
  { bg: "#fce7f3", text: "#be185d" },
  { bg: "#dbeafe", text: "#1d4ed8" },
  { bg: "#d1fae5", text: "#065f46" },
  { bg: "#fef3c7", text: "#92400e" },
  { bg: "#ede9fe", text: "#7c3aed" },
  { bg: "#fee2e2", text: "#991b1b" },
];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatCommentTime(dt) {
  const d = new Date(dt + "Z");
  const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}시간 전`;
  return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

const TODAY = new Date();

export default function HubPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState("friends");

  // ── 친구 탭 상태 ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const searchTimer = useRef(null);

  // ── 그룹 탭 상태 ──
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [addMemberSearch, setAddMemberSearch] = useState("");

  // ── 공유 탭 상태 ──
  const [feedGroupId, setFeedGroupId] = useState("");
  const [feed, setFeed] = useState(null);
  const [feedLoading, setFeedLoading] = useState(false);

  // ── Group Goal Twin 상태 ──
  const [groupGoals, setGroupGoals] = useState([]);
  const [groupProjects, setGroupProjects] = useState([]);
  const [groupStats, setGroupStats] = useState(null);
  const [expandMemberGoals, setExpandMemberGoals] = useState(false);
  const [showNewGroupGoalForm, setShowNewGroupGoalForm] = useState(false);
  const [newGroupGoal, setNewGroupGoal] = useState({ title: "", target_date: "" });
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProject, setNewProject] = useState({ title: "", description: "", deadline: "" });
  const [addingTaskTo, setAddingTaskTo] = useState(null); // project id
  const [newTask, setNewTask] = useState({ title: "", deadline: "", assigned_to: "" });
  const [aiLoading, setAiLoading] = useState({}); // { [projectId]: bool }
  const [aiResult, setAiResult] = useState({});   // { [projectId]: result }

  // ── 친구 캘린더 상태 ──
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [friendTasks, setFriendTasks] = useState([]);
  const [friendTasksLoading, setFriendTasksLoading] = useState(false);
  const [friendShareView, setFriendShareView] = useState("list");
  const [friendCalYear, setFriendCalYear] = useState(TODAY.getFullYear());
  const [friendCalMonth, setFriendCalMonth] = useState(TODAY.getMonth());

  // 댓글 모달
  const [commentModal, setCommentModal] = useState(null); // { taskId, taskTitle }
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState(null); // { id, nickname }
  const [myUserId, setMyUserId] = useState(null);

  useEffect(() => {
    loadFriendsData();
    loadGroups();
    apiFetch("/auth/me").then(u => setMyUserId(u.id)).catch(() => {});
  }, []);

  async function loadFriendsData() {
    setFriendsLoading(true);
    try {
      const [reqs, frs] = await Promise.all([friendsApi.listRequests(), friendsApi.list()]);
      setRequests(reqs); setFriends(frs);
    } catch { } finally { setFriendsLoading(false); }
  }

  async function loadGroups() {
    setGroupsLoading(true);
    try { setGroups(await groupsApi.list()); }
    catch { } finally { setGroupsLoading(false); }
  }

  function handleSearchChange(e) {
    const q = e.target.value;
    setSearchQuery(q); setSearchError("");
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        setSearchResults(await friendsApi.search(q.trim())); setSearchError("");
      } catch (err) { setSearchResults([]); setSearchError(err.message); }
      finally { setSearching(false); }
    }, 300);
  }

  async function handleSendRequest(userId) {
    try {
      await friendsApi.sendRequest(userId);
      setSearchResults(prev => prev.map(r => r.id === userId ? { ...r, request_pending: true } : r));
    } catch (err) { alert(err.message); }
  }

  async function handleAccept(requestId) {
    try { await friendsApi.acceptRequest(requestId); setRequests(prev => prev.filter(r => r.id !== requestId)); await loadFriendsData(); }
    catch (err) { alert(err.message); }
  }

  async function handleDecline(requestId) {
    try { await friendsApi.declineRequest(requestId); setRequests(prev => prev.filter(r => r.id !== requestId)); }
    catch (err) { alert(err.message); }
  }

  async function handleRemoveFriend(friendshipId) {
    if (!window.confirm("친구를 삭제하시겠어요?")) return;
    try { await friendsApi.remove(friendshipId); setFriends(prev => prev.filter(f => f.id !== friendshipId)); }
    catch (err) { alert(err.message); }
  }

  async function handleCreateGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    try { const created = await groupsApi.create(name); setGroups(prev => [...prev, created]); setNewGroupName(""); setShowGroupForm(false); }
    catch (err) { alert(err.message); }
  }

  async function handleOpenGroup(group) {
    setSelectedGroup(group);
    try { setGroupDetail(await groupsApi.get(group.id)); }
    catch (err) { alert(err.message); }
  }

  async function handleAddMember(userId) {
    try { const detail = await groupsApi.addMember(selectedGroup.id, userId); setGroupDetail(detail); setAddMemberSearch(""); }
    catch (err) { alert(err.message); }
  }

  async function handleLeaveGroup(groupId) {
    if (!window.confirm("그룹을 나가시겠어요?")) return;
    try {
      await groupsApi.removeMember(groupId, groupDetail?.members?.find(() => true)?.id ?? 0);
      setGroups(prev => prev.filter(g => g.id !== groupId)); setSelectedGroup(null); setGroupDetail(null);
    } catch {
      await loadGroups(); setSelectedGroup(null); setGroupDetail(null);
    }
  }

  async function handleLoadFeed(groupId) {
    setFeedLoading(true); setFeed(null);
    setGroupGoals([]); setGroupProjects([]); setGroupStats(null);
    setExpandMemberGoals(false); setShowNewGroupGoalForm(false); setShowNewProjectForm(false);
    setAiLoading({}); setAiResult({});
    try { setFeed(await groupsApi.getFeed(groupId)); }
    catch (err) { alert(err.message); } finally { setFeedLoading(false); }
    // Group Goal Twin 데이터 로드 (실패해도 피드는 보여줌)
    Promise.allSettled([
      groupGoalsApi.list(groupId),
      groupProjectsApi.list(groupId),
      groupStatsApi.get(groupId),
    ]).then(([goalsRes, projectsRes, statsRes]) => {
      if (goalsRes.status === "fulfilled") setGroupGoals(goalsRes.value);
      if (projectsRes.status === "fulfilled") setGroupProjects(projectsRes.value);
      if (statsRes.status === "fulfilled") setGroupStats(statsRes.value);
    });
  }

  async function handleCreateGroupGoal() {
    if (!newGroupGoal.title.trim() || !feedGroupId) return;
    try {
      const created = await groupGoalsApi.create(feedGroupId, { title: newGroupGoal.title.trim(), target_date: newGroupGoal.target_date || null });
      setGroupGoals(prev => [...prev, created]);
      setNewGroupGoal({ title: "", target_date: "" });
      setShowNewGroupGoalForm(false);
    } catch (err) { alert(err.message); }
  }

  async function handleDeleteGroupGoal(goalId) {
    if (!window.confirm("그룹 목표를 삭제할까요?")) return;
    try {
      await groupGoalsApi.delete(feedGroupId, goalId);
      setGroupGoals(prev => prev.filter(g => g.id !== goalId));
    } catch (err) { alert(err.message); }
  }

  async function handleCreateGroupProject() {
    if (!newProject.title.trim() || !feedGroupId) return;
    try {
      const created = await groupProjectsApi.create(feedGroupId, { title: newProject.title.trim(), description: newProject.description || null, deadline: newProject.deadline || null });
      setGroupProjects(prev => [created, ...prev]);
      setNewProject({ title: "", description: "", deadline: "" });
      setShowNewProjectForm(false);
    } catch (err) { alert(err.message); }
  }

  async function handleAddGroupTask(projectId) {
    if (!newTask.title.trim()) return;
    try {
      const updated = await groupProjectsApi.addTask(feedGroupId, projectId, {
        title: newTask.title.trim(),
        deadline: newTask.deadline || null,
        assigned_to: newTask.assigned_to ? parseInt(newTask.assigned_to) : null,
      });
      setGroupProjects(prev => prev.map(p => p.id === projectId ? updated : p));
      setNewTask({ title: "", deadline: "", assigned_to: "" });
      setAddingTaskTo(null);
    } catch (err) { alert(err.message); }
  }

  async function handleToggleGroupTask(projectId, taskId, isDone) {
    try {
      const updated = await groupProjectsApi.updateTask(feedGroupId, projectId, taskId, { is_done: isDone });
      setGroupProjects(prev => prev.map(p => p.id === projectId ? updated : p));
      // 달성률 갱신
      const goals = await groupGoalsApi.list(feedGroupId);
      setGroupGoals(goals);
    } catch (err) { alert(err.message); }
  }

  async function handleAiFeedback(projectId) {
    setAiLoading(prev => ({ ...prev, [projectId]: true }));
    try {
      const result = await groupProjectsApi.aiFeedback(feedGroupId, projectId);
      setAiResult(prev => ({ ...prev, [projectId]: result }));
    } catch (err) { alert(err.message); }
    finally { setAiLoading(prev => ({ ...prev, [projectId]: false })); }
  }

  // ── 댓글 모달 ──
  async function openCommentModal(taskId, taskTitle) {
    setCommentModal({ taskId, taskTitle });
    setCommentText(""); setReplyTo(null); setComments([]);
    try { setComments(await taskCommentsApi.list(taskId)); } catch {}
  }

  async function handleAddComment() {
    if (!commentText.trim() || !commentModal) return;
    try {
      await taskCommentsApi.create(commentModal.taskId, commentText.trim(), replyTo?.id ?? null);
      setCommentText(""); setReplyTo(null);
      setComments(await taskCommentsApi.list(commentModal.taskId));
    } catch {}
  }

  async function handleDeleteComment(commentId) {
    if (!commentModal) return;
    try {
      await taskCommentsApi.delete(commentModal.taskId, commentId);
      setComments(await taskCommentsApi.list(commentModal.taskId));
    } catch {}
  }

  // ── 친구 캘린더 fetch ──
  async function handleSelectFriend(userId) {
    if (selectedFriendId === userId) {
      setSelectedFriendId(null);
      setFriendTasks([]);
      return;
    }
    setSelectedFriendId(userId);
    setFriendTasksLoading(true);
    try {
      setFriendTasks(await friendsApi.getFriendTasks(userId));
    } catch (err) {
      alert(err.message);
    } finally {
      setFriendTasksLoading(false);
    }
  }

  // ── 다일 이벤트 헬퍼 ──
  function toHubDateStr(dt) {
    const d = new Date(dt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function isMultiDayTask(t) {
    return toHubDateStr(t.start_at) !== toHubDateStr(t.end_at);
  }
  function packHubBars(bars) {
    const result = [];
    for (const bar of bars) {
      let row = 1;
      while (result.some(b => b.row === row && b.startCol < bar.endCol && b.endCol > bar.startCol)) row++;
      result.push({ ...bar, row });
    }
    return result;
  }
  function getHubMultiDayBars(weekDays, tasks, yr, mo) {
    const bars = [];
    for (const task of tasks.filter(isMultiDayTask)) {
      const ts = new Date(task.start_at); ts.setHours(0, 0, 0, 0);
      const te = new Date(task.end_at);   te.setHours(23, 59, 59, 999);
      let startCol = -1, endCol = -1;
      for (let col = 0; col < 7; col++) {
        const d = weekDays[col];
        if (!d) continue;
        const cd = new Date(yr, mo, d);
        if (cd >= ts && cd <= te) { if (startCol === -1) startCol = col; endCol = col; }
      }
      if (startCol !== -1) bars.push({ task, startCol: startCol + 1, endCol: endCol + 2 });
    }
    return packHubBars(bars);
  }

  // 친구 캘린더 주 배열
  const fcFirstDow = new Date(friendCalYear, friendCalMonth, 1).getDay();
  const fcDaysInMonth = new Date(friendCalYear, friendCalMonth + 1, 0).getDate();
  const fcCalDays = [...Array(fcFirstDow).fill(null), ...Array.from({ length: fcDaysInMonth }, (_, i) => i + 1)];
  while (fcCalDays.length % 7 !== 0) fcCalDays.push(null);
  const fcCalWeeks = [];
  for (let i = 0; i < fcCalDays.length; i += 7) fcCalWeeks.push(fcCalDays.slice(i, i + 7));

  const friendsNotInGroup = friends.filter(f => !groupDetail?.members?.some(m => m.id === f.user.id));
  const filteredFriendsForAdd = addMemberSearch
    ? friendsNotInGroup.filter(f => (f.user.nickname ?? "").toLowerCase().includes(addMemberSearch.toLowerCase()))
    : friendsNotInGroup;

  const topComments = comments.filter(c => !c.parent_id);

  return (
    <div className="app-layout">
      <header className="app-header">
        <button className="app-header-logo" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => navigate("/")}>
          <img src="/assets/twinny/twinny_open.png" className="header-logo-img" alt="" />
          Twin Time
        </button>
        <button className="btn btn-ghost" onClick={logout}>로그아웃</button>
      </header>

      <div className="hub-main">
        {/* ── 탭 ── */}
        <div className="hub-tabs">
          {[{ key: "friends", label: "친구" }, { key: "groups", label: "그룹" }, { key: "share", label: "공유" }].map(t => (
            <button key={t.key} className={`hub-tab${activeTab === t.key ? " active" : ""}`} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ════════════════════ 친구 탭 ════════════════════ */}
        {activeTab === "friends" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <div className="hub-section-title">친구 찾기</div>
              <input className="edit-goal-input" type="text" placeholder="닉네임으로 검색..." value={searchQuery}
                onChange={handleSearchChange} style={{ width: "100%", marginBottom: "0.5rem" }} />
              {searchError && <p style={{ fontSize: "0.85rem", color: "#f87171", margin: "0.25rem 0 0" }}>{searchError}</p>}
              {searching && <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0.25rem 0 0" }}>검색 중...</p>}
              {!searching && !searchError && searchQuery.trim() && searchResults.length === 0 && (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0.25rem 0 0" }}>닉네임이 일치하는 사용자가 없어요.</p>
              )}
              {!searching && searchResults.length > 0 && (
                <div style={{ background: "#fff", border: "1.5px solid var(--border)", borderRadius: "0.875rem", padding: "0.5rem 0.75rem" }}>
                  {searchResults.map(r => (
                    <div key={r.id} className="search-result-row">
                      <span style={{ fontWeight: 600 }}>{r.nickname}</span>
                      {r.already_friend ? <span style={{ fontSize: "0.8rem", color: "#34d399", fontWeight: 600 }}>친구 ✓</span>
                        : r.request_pending ? <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>요청 중...</span>
                          : <button className="btn btn-primary" style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }} onClick={() => handleSendRequest(r.id)}>친구 추가</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {requests.length > 0 && (
              <div>
                <div className="hub-section-title">받은 친구 신청 ({requests.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {requests.map(r => (
                    <div key={r.id} className="friend-card">
                      <span className="friend-card-name">
                        {r.requester?.nickname ?? r.requester?.email?.split("@")[0] ?? `User #${r.user_id}`}
                        {!r.requester?.nickname && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.3rem" }}>(닉네임 미설정)</span>}
                      </span>
                      <div className="friend-card-actions">
                        <button className="btn btn-primary" style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }} onClick={() => handleAccept(r.id)}>수락</button>
                        <button className="btn btn-ghost" style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }} onClick={() => handleDecline(r.id)}>거절</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="hub-section-title">내 친구 ({friends.length}명)</div>
              {friendsLoading ? <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>불러오는 중...</div>
                : friends.length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>아직 친구가 없어요.</div>
                  : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {friends.map(f => (
                        <div key={f.id} className="friend-card">
                          <span className="friend-card-name">{f.user.nickname ?? `User #${f.user.id}`}</span>
                          <button className="btn btn-ghost" style={{ padding: "0.25rem 0.7rem", fontSize: "0.78rem", color: "#f87171" }} onClick={() => handleRemoveFriend(f.id)}>삭제</button>
                        </div>
                      ))}
                    </div>
                  )}
            </div>
          </div>
        )}

        {/* ════════════════════ 그룹 탭 ════════════════════ */}
        {activeTab === "groups" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="hub-section-title" style={{ marginBottom: 0 }}>내 그룹</div>
              <button className="btn btn-primary" style={{ padding: "0.35rem 0.9rem", fontSize: "0.85rem" }} onClick={() => setShowGroupForm(v => !v)}>+ 새 그룹</button>
            </div>
            {showGroupForm && (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input className="edit-goal-input" type="text" placeholder="그룹 이름 입력..." value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()} maxLength={60} style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={handleCreateGroup}>만들기</button>
                <button className="btn btn-ghost" onClick={() => { setShowGroupForm(false); setNewGroupName(""); }}>취소</button>
              </div>
            )}
            {groupsLoading ? <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>불러오는 중...</div>
              : groups.length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>그룹이 없어요.</div>
                : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {groups.map(g => (
                      <div key={g.id} className="friend-card" style={{ cursor: "pointer" }} onClick={() => handleOpenGroup(g)}>
                        <div>
                          <div className="friend-card-name">{g.name}</div>
                          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>멤버 {g.member_count}명</div>
                        </div>
                        <span style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}>›</span>
                      </div>
                    ))}
                  </div>
                )}

            {selectedGroup && (
              <div className="modal-overlay" onClick={() => { setSelectedGroup(null); setGroupDetail(null); setAddMemberSearch(""); }}>
                <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{selectedGroup.name}</h3>
                    <button className="btn btn-ghost" style={{ padding: "0.25rem 0.6rem" }} onClick={() => { setSelectedGroup(null); setGroupDetail(null); }}>✕</button>
                  </div>
                  {!groupDetail ? <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>불러오는 중...</div> : (
                    <>
                      <div className="hub-section-title">멤버</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1rem" }}>
                        {groupDetail.members.map(m => (
                          <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 0.6rem", background: "var(--primary-light)", borderRadius: "0.6rem" }}>
                            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{m.nickname ?? `User #${m.id}`}</span>
                            {groupDetail.owner_id !== m.id && (
                              <button className="btn btn-ghost" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem", color: "#f87171" }} onClick={() => handleLeaveGroup(selectedGroup.id)}>내보내기</button>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="hub-section-title">친구 초대</div>
                      <input className="edit-goal-input" type="text" placeholder="친구 닉네임 검색..." value={addMemberSearch}
                        onChange={(e) => setAddMemberSearch(e.target.value)} style={{ width: "100%", marginBottom: "0.5rem" }} />
                      {filteredFriendsForAdd.length === 0
                        ? <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{friends.length === 0 ? "친구를 먼저 추가해주세요" : "초대할 수 있는 친구가 없어요"}</div>
                        : filteredFriendsForAdd.map(f => (
                          <div key={f.id} className="search-result-row">
                            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{f.user.nickname}</span>
                            <button className="btn btn-primary" style={{ padding: "0.25rem 0.7rem", fontSize: "0.78rem" }} onClick={() => handleAddMember(f.user.id)}>초대</button>
                          </div>
                        ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════ 공유 탭 ════════════════════ */}
        {activeTab === "share" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

            {/* ── 친구 캘린더 ── */}
            <div>
              <div className="hub-section-title">친구 캘린더</div>
              {friends.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>친구를 추가하면 일정을 볼 수 있어요.</div>
              ) : (
                <div className="hub-friend-chips">
                  {friends.map((f, fi) => {
                    const palette = MEMBER_PALETTES[fi % MEMBER_PALETTES.length];
                    const isActive = selectedFriendId === f.user.id;
                    return (
                      <button
                        key={f.id}
                        className={`hub-friend-chip${isActive ? " active" : ""}`}
                        style={isActive ? { background: palette.bg, color: palette.text, borderColor: palette.text } : undefined}
                        onClick={() => handleSelectFriend(f.user.id)}
                      >
                        {f.user.nickname ?? `User #${f.user.id}`}
                      </button>
                    );
                  })}
                </div>
              )}

              {friendTasksLoading && <div style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.5rem" }}>불러오는 중...</div>}

              {selectedFriendId && !friendTasksLoading && (() => {
                const fi = friends.findIndex(f => f.user.id === selectedFriendId);
                const fPalette = MEMBER_PALETTES[fi % MEMBER_PALETTES.length] ?? MEMBER_PALETTES[0];
                const getFPalette = () => fPalette;
                const HUB_BAR_H = 20;
                const HUB_DAY_NUM_H = 22;
                return (
                  <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div className="hub-view-toggle">
                      <button className={`hub-view-btn${friendShareView === "list" ? " active" : ""}`} onClick={() => setFriendShareView("list")}>목록</button>
                      <button className={`hub-view-btn${friendShareView === "calendar" ? " active" : ""}`} onClick={() => setFriendShareView("calendar")}>캘린더</button>
                    </div>

                    {/* 친구 목록 뷰 */}
                    {friendShareView === "list" && (
                      friendTasks.length === 0
                        ? <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>공개된 일정이 없어요.</div>
                        : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            {friendTasks.map(t => {
                              const start = new Date(t.start_at);
                              return (
                                <div key={t.id} className="hub-task-row" style={{ borderLeftColor: CATEGORY_COLORS[t.category] ?? "#a78bfa" }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{t.title}</div>
                                    <div style={{ fontSize: "0.77rem", color: "var(--text-muted)" }}>
                                      {start.getMonth() + 1}/{start.getDate()}
                                      {isMultiDayTask(t) && <span className="task-multiday-badge" style={{ marginLeft: "0.3rem" }}>다일</span>}
                                    </div>
                                  </div>
                                  <button className="hub-comment-btn" onClick={() => openCommentModal(t.id, t.title)}>💬</button>
                                </div>
                              );
                            })}
                          </div>
                        )
                    )}

                    {/* 친구 캘린더 뷰 */}
                    {friendShareView === "calendar" && (
                      <div className="hub-cal-wrap">
                        <div className="hub-cal-nav">
                          <button className="btn btn-ghost btn-sm" onClick={() => { if (friendCalMonth === 0) { setFriendCalYear(y => y - 1); setFriendCalMonth(11); } else setFriendCalMonth(m => m - 1); }}>‹</button>
                          <span className="hub-cal-title">{friendCalYear}년 {friendCalMonth + 1}월</span>
                          <button className="btn btn-ghost btn-sm" onClick={() => { if (friendCalMonth === 11) { setFriendCalYear(y => y + 1); setFriendCalMonth(0); } else setFriendCalMonth(m => m + 1); }}>›</button>
                        </div>
                        <div className="hub-cal-header">
                          {WEEKDAYS.map((w, i) => (
                            <div key={w} className="hub-cal-dow" style={{ color: i === 0 ? "#ef4444" : i === 6 ? "#3b82f6" : undefined }}>{w}</div>
                          ))}
                        </div>
                        <div className="hub-cal-grid">
                          {fcCalWeeks.map((weekDays, wi) => {
                            const bars = getHubMultiDayBars(weekDays, friendTasks, friendCalYear, friendCalMonth);
                            const maxRow = bars.reduce((m, b) => Math.max(m, b.row), 0);
                            return (
                              <div key={wi} className="hub-cal-week">
                                {bars.map((bar, bi) => (
                                  <div key={bi} className="hub-cal-bar"
                                    style={{
                                      top: `${HUB_DAY_NUM_H + (bar.row - 1) * HUB_BAR_H}px`,
                                      left: `calc(${((bar.startCol - 1) / 7) * 100}% + 1px)`,
                                      width: `calc(${((bar.endCol - bar.startCol) / 7) * 100}% - 3px)`,
                                      background: getFPalette().bg, color: getFPalette().text,
                                    }}
                                    onClick={() => openCommentModal(bar.task.id, bar.task.title)}
                                  >{bar.task.title}</div>
                                ))}
                                <div className="hub-cal-week-days">
                                  {weekDays.map((day, col) => {
                                    const colTasks = day ? friendTasks.filter(t => {
                                      if (isMultiDayTask(t)) return false;
                                      const d = new Date(t.start_at);
                                      return d.getFullYear() === friendCalYear && d.getMonth() === friendCalMonth && d.getDate() === day;
                                    }) : [];
                                    const isToday = day && TODAY.getFullYear() === friendCalYear && TODAY.getMonth() === friendCalMonth && TODAY.getDate() === day;
                                    return (
                                      <div key={col} className={`hub-cal-cell${!day ? " empty" : ""}${isToday ? " today" : ""}`}
                                        style={maxRow > 0 ? { paddingTop: `${HUB_DAY_NUM_H + maxRow * HUB_BAR_H + 2}px` } : undefined}>
                                        {day && (
                                          <>
                                            <span className="hub-cal-day" style={{ color: col === 0 ? "#ef4444" : col === 6 ? "#3b82f6" : undefined }}>{day}</span>
                                            {colTasks.slice(0, 2).map(t => (
                                              <div key={t.id} className="hub-cal-chip"
                                                style={{ background: fPalette.bg, color: fPalette.text }}
                                                onClick={() => openCommentModal(t.id, t.title)} title={t.title}>{t.title}</div>
                                            ))}
                                            {colTasks.length > 2 && <div className="hub-cal-more">+{colTasks.length - 2}</div>}
                                          </>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* ── 그룹 선택 드롭다운 ── */}
            <div>
              <div className="hub-section-title">그룹 피드</div>
              <select className="edit-goal-input" value={feedGroupId}
                onChange={(e) => {
                  const gid = e.target.value;
                  setFeedGroupId(gid);
                  if (gid) handleLoadFeed(gid);
                  else { setFeed(null); setGroupGoals([]); setGroupProjects([]); setGroupStats(null); }
                }}
                style={{ width: "100%", marginBottom: "0.75rem" }}>
                <option value="">그룹을 선택하세요</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>

              {!feedGroupId && (
                <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>그룹을 선택하면 멤버 목표와 그룹 활동을 볼 수 있어요.</div>
              )}
              {feedLoading && <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>불러오는 중...</div>}

              {/* ── 멤버 목표 구경 ── */}
              {feed && !feedLoading && (
                <div style={{ marginBottom: "1rem" }}>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: "0.875rem", padding: "0.3rem 0.75rem", marginBottom: "0.5rem" }}
                    onClick={() => setExpandMemberGoals(v => !v)}
                  >
                    👥 멤버 목표 보기 {expandMemberGoals ? "▲" : "▼"}
                  </button>
                  {expandMemberGoals && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", padding: "0.5rem 0" }}>
                      {feed.members.map((member, mi) => {
                        const memberGoals = feed.goals.filter(g => g.user_id === member.id);
                        const palette = MEMBER_PALETTES[mi % MEMBER_PALETTES.length];
                        return (
                          <div key={member.id} style={{ borderLeft: `3px solid ${palette.text}`, paddingLeft: "0.75rem" }}>
                            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: palette.text, marginBottom: "0.3rem" }}>
                              {member.nickname ?? `User #${member.id}`}
                            </div>
                            {memberGoals.length === 0
                              ? <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>등록된 목표가 없어요</div>
                              : (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                                  {memberGoals.map(g => (
                                    <span key={g.id} className="home-goal-chip">
                                      <span className="home-goal-chip-type">{GOAL_TYPE_LABELS[g.type] ?? g.type}</span>
                                      {g.text}
                                    </span>
                                  ))}
                                </div>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Group Goal Twin ── */}
            {feedGroupId && (
              <div className="ggt-wrap">
                <div className="hub-section-title">Group Goal Twin</div>

                {/* 그룹 통계 — 한눈에 파악 (최상단) */}
                {groupStats && (() => {
                  const grpName = groups.find(g => String(g.id) === feedGroupId)?.name ?? "그룹";
                  return (
                    <div className="ggt-stats-grid">
                      <div className="ggt-stat-card">
                        <div className="ggt-stat-label">{grpName}<br />평균 수면</div>
                        <div className="ggt-stat-value">
                          {groupStats.avg_sleep_7d != null ? `${groupStats.avg_sleep_7d}h` : "—"}
                        </div>
                        <div className="ggt-stat-sub">최근 7일 기준</div>
                      </div>
                      <div className="ggt-stat-card">
                        <div className="ggt-stat-label">{grpName}<br />평균 프로젝트 진행률</div>
                        <div className="ggt-stat-value">{groupStats.avg_project_progress}%</div>
                        <div className="ggt-stat-sub">개인 프로젝트 기준</div>
                      </div>
                    </div>
                  );
                })()}

                {/* 그룹 목표 */}
                <div className="ggt-panel">
                  <div className="ggt-panel-title">
                    <span className="ggt-panel-title-text">🎯 그룹 목표</span>
                    <button className="btn btn-ghost" style={{ fontSize: "0.8rem", padding: "0.2rem 0.6rem" }}
                      onClick={() => setShowNewGroupGoalForm(v => !v)}>
                      {showNewGroupGoalForm ? "취소" : "+ 추가"}
                    </button>
                  </div>

                  {showNewGroupGoalForm && (
                    <div className="ggt-form">
                      <input className="edit-goal-input" placeholder="목표 제목" value={newGroupGoal.title}
                        onChange={e => setNewGroupGoal(v => ({ ...v, title: e.target.value }))} />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <input className="edit-goal-input" type="date" value={newGroupGoal.target_date}
                          onChange={e => setNewGroupGoal(v => ({ ...v, target_date: e.target.value }))}
                          style={{ flex: 1 }} />
                        <button className="btn btn-primary" style={{ fontSize: "0.85rem" }} onClick={handleCreateGroupGoal}>저장</button>
                      </div>
                    </div>
                  )}

                  {groupGoals.length === 0 && !showNewGroupGoalForm
                    ? <div className="ggt-empty">그룹 목표를 설정해보세요 🎯</div>
                    : groupGoals.map(goal => (
                      <div key={goal.id} className="ggt-goal-row">
                        <div className="ggt-goal-meta">
                          <span className="ggt-goal-title">{goal.title}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span className="ggt-goal-pct">{Math.round(goal.achievement_rate * 100)}%</span>
                            <button className="btn btn-ghost" style={{ fontSize: "0.7rem", padding: "0.05rem 0.35rem", color: "#ef4444" }}
                              onClick={() => handleDeleteGroupGoal(goal.id)}>✕</button>
                          </div>
                        </div>
                        {goal.target_date && <div className="ggt-goal-date">목표일 {goal.target_date}</div>}
                        <div className="ggt-bar">
                          <div className="ggt-bar-fill" style={{ width: `${goal.achievement_rate * 100}%` }} />
                        </div>
                      </div>
                    ))
                  }
                </div>

                {/* 그룹 프로젝트 */}
                <div className="ggt-panel">
                  <div className="ggt-panel-title">
                    <span className="ggt-panel-title-text">📂 그룹 프로젝트</span>
                    <button className="btn btn-primary" style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                      onClick={() => setShowNewProjectForm(v => !v)}>
                      {showNewProjectForm ? "취소" : "+ 생성하기"}
                    </button>
                  </div>

                  {showNewProjectForm && (
                    <div className="ggt-form">
                      <input className="edit-goal-input" placeholder="프로젝트 제목 *" value={newProject.title}
                        onChange={e => setNewProject(v => ({ ...v, title: e.target.value }))} />
                      <input className="edit-goal-input" placeholder="설명 (선택)" value={newProject.description}
                        onChange={e => setNewProject(v => ({ ...v, description: e.target.value }))} />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <input className="edit-goal-input" type="date" value={newProject.deadline}
                          onChange={e => setNewProject(v => ({ ...v, deadline: e.target.value }))}
                          style={{ flex: 1 }} />
                        <button className="btn btn-primary" style={{ fontSize: "0.85rem" }} onClick={handleCreateGroupProject}>생성</button>
                      </div>
                    </div>
                  )}

                  {groupProjects.length === 0 && !showNewProjectForm && (
                    <div className="ggt-empty">팀 프로젝트를 만들어 함께 진행해보세요 📂</div>
                  )}

                  {groupProjects.map(project => (
                    <div key={project.id} className="ggt-project-card">
                      {/* 프로젝트 헤더 */}
                      <div className="ggt-project-header">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="ggt-project-title">{project.title}</div>
                          {project.description && <div className="ggt-project-desc">{project.description}</div>}
                          {project.deadline && <div className="ggt-project-deadline">마감 {project.deadline}</div>}
                        </div>
                        <div className="ggt-project-right">
                          <span className="ggt-project-pct">{project.stats.completion_pct}%</span>
                          {project.stats.overdue_count > 0 && (
                            <span className="ggt-overdue-badge">⚠️ {project.stats.overdue_count}건 미완료</span>
                          )}
                        </div>
                      </div>

                      {/* 진행 바 */}
                      <div className="ggt-bar">
                        <div className="ggt-bar-fill project" style={{ width: `${project.stats.completion_pct}%` }} />
                      </div>
                      <div className="ggt-bar-meta">완료 {project.stats.done} / 전체 {project.stats.total}</div>

                      {/* 태스크 목록 */}
                      <div className="ggt-task-list">
                        {project.tasks.map(task => {
                          const memberIdx = feed?.members?.findIndex(m => m.id === task.assigned_to) ?? -1;
                          const pal = memberIdx >= 0 ? MEMBER_PALETTES[memberIdx % MEMBER_PALETTES.length] : null;
                          return (
                            <div key={task.id} className={`ggt-task-row${task.is_overdue ? " ggt-task-overdue" : ""}`}>
                              <input type="checkbox" checked={task.is_done}
                                onChange={e => handleToggleGroupTask(project.id, task.id, e.target.checked)}
                                style={{ accentColor: "var(--primary-dark)", width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
                              {pal && (
                                <span className="ggt-assignee-chip" style={{ background: pal.bg, color: pal.text }}>
                                  {task.assigned_nickname}
                                </span>
                              )}
                              <span className={`ggt-task-title${task.is_done ? " done" : ""}`}>{task.title}</span>
                              {task.deadline && (
                                <span className={`ggt-task-date${task.is_overdue ? " overdue" : ""}`}>{task.deadline}</span>
                              )}
                              {task.is_overdue && <span className="ggt-overdue-badge">기한초과</span>}
                              {task.overdue_recorded && !task.is_overdue && <span className="ggt-recorded-badge">기록됨</span>}
                            </div>
                          );
                        })}
                      </div>

                      {/* 태스크 추가 폼 */}
                      {addingTaskTo === project.id ? (
                        <div className="ggt-add-task-form">
                          <input className="edit-goal-input" placeholder="태스크 제목 *" value={newTask.title}
                            onChange={e => setNewTask(v => ({ ...v, title: e.target.value }))}
                            style={{ flex: 1, minWidth: "120px" }} />
                          <select className="edit-goal-input" value={newTask.assigned_to}
                            onChange={e => setNewTask(v => ({ ...v, assigned_to: e.target.value }))}
                            style={{ width: "110px" }}>
                            <option value="">담당자</option>
                            {feed?.members?.map(m => (
                              <option key={m.id} value={m.id}>{m.nickname ?? `User #${m.id}`}</option>
                            ))}
                          </select>
                          <input className="edit-goal-input" type="date" value={newTask.deadline}
                            onChange={e => setNewTask(v => ({ ...v, deadline: e.target.value }))}
                            style={{ width: "130px" }} />
                          <button className="btn btn-primary" style={{ fontSize: "0.82rem" }}
                            onClick={() => handleAddGroupTask(project.id)}>추가</button>
                          <button className="btn btn-ghost" style={{ fontSize: "0.82rem" }}
                            onClick={() => { setAddingTaskTo(null); setNewTask({ title: "", deadline: "", assigned_to: "" }); }}>취소</button>
                        </div>
                      ) : (
                        <button className="btn btn-ghost ggt-add-task-btn"
                          onClick={() => { setAddingTaskTo(project.id); setNewTask({ title: "", deadline: "", assigned_to: "" }); }}>
                          + 태스크 추가
                        </button>
                      )}

                      {/* 하단 액션 버튼 */}
                      <div className="ggt-actions">
                        <button className="ggt-action-btn" onClick={() => openCommentModal(project.id, project.title)}>
                          💬 댓글
                        </button>
                        <button
                          className={`ggt-action-btn ai${aiResult[project.id] ? " active" : ""}`}
                          onClick={() => handleAiFeedback(project.id)}
                          disabled={aiLoading[project.id]}
                        >
                          {aiLoading[project.id] ? "⏳ 분석 중..." : "🤖 AI 피드백"}
                        </button>
                      </div>

                      {/* AI 결과 */}
                      {aiResult[project.id] && (
                        <div className="ggt-ai-panel">
                          <div className="ggt-ai-panel-title">🤖 AI 피드백</div>
                          <p className="ggt-ai-feedback-text">{aiResult[project.id].feedback_text}</p>
                          {aiResult[project.id].role_suggestions?.length > 0 && (
                            <>
                              <div className="ggt-ai-suggestions-title">역할 분배 추천</div>
                              {aiResult[project.id].role_suggestions.map((s, si) => (
                                <div key={si} className="ggt-ai-suggestion">
                                  <strong>{s.task_title}</strong> → {s.suggested_nickname}
                                  <span>{s.reason}</span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 댓글 모달 ── */}
      {commentModal && (
        <div className="modal-overlay" onClick={() => setCommentModal(null)}>
          <div className="modal-card modal-card-wide" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>💬 {commentModal.taskTitle}</h3>
              <button className="btn btn-ghost" style={{ padding: "0.25rem 0.6rem" }} onClick={() => setCommentModal(null)}>✕</button>
            </div>

            <div className="task-comments-section" style={{ marginTop: 0 }}>
              {topComments.length === 0 && <div className="task-comments-empty">첫 댓글을 남겨보세요!</div>}

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
                      <button className="comment-reply-btn"
                        onClick={() => setReplyTo(replyTo?.id === comment.id ? null : { id: comment.id, nickname: comment.nickname })}>
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

              <div className="comment-input-area">
                {replyTo && (
                  <div className="comment-reply-target">
                    ↩ <strong>{replyTo.nickname}</strong> 님에게 답글
                    <button className="comment-reply-cancel" onClick={() => setReplyTo(null)}>✕</button>
                  </div>
                )}
                <div className="comment-input-row">
                  <input className="comment-input" type="text"
                    placeholder={replyTo ? "답글을 입력하세요..." : "댓글을 입력하세요..."}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleAddComment}>등록</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
