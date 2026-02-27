import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { goalsApi, projectsApi } from "../api/client";
import TwinnyPanel from "../components/TwinnyPanel";

const GOAL_TYPE_LABELS = {
  daily: "매일", weekly: "매주", monthly: "매월",
  "6months": "6개월", "1year": "1년",
};
const DIFFICULTY_LABELS = ["", "쉬움", "보통", "도전", "어려움", "최상급"];

function DifficultyDots({ value }) {
  return (
    <span className="gt-difficulty">
      {[1, 2, 3, 4, 5].map((d) => (
        <span key={d} className={`gt-dot ${d <= value ? "gt-dot-on" : ""}`} />
      ))}
    </span>
  );
}

function ProjectCard({ project, onRefresh }) {
  const { stats } = project;
  const [expanded, setExpanded] = useState(true);
  const [addingTask, setAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", estimated_hours: "", difficulty: "", deadline: "" });
  const [saving, setSaving] = useState(false);
  const [editingMemo, setEditingMemo] = useState(null); // task.id or null
  const [memoValue, setMemoValue] = useState("");
  const [twinnyLoading, setTwinnyLoading] = useState(false);
  const [twinnyResult, setTwinnyResult] = useState(null);
  const [activeTab, setActiveTab] = useState("all"); // "all" | "log"

  async function toggleDone(task) {
    try {
      await projectsApi.updateTask(project.id, task.id, { is_done: !task.is_done });
      onRefresh();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleAddTask(e) {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setSaving(true);
    try {
      await projectsApi.addTask(project.id, {
        title: newTask.title.trim(),
        estimated_hours: newTask.estimated_hours ? parseFloat(newTask.estimated_hours) : null,
        difficulty: newTask.difficulty ? parseInt(newTask.difficulty) : null,
        order_index: project.tasks.length,
        deadline: newTask.deadline || null,
      });
      setNewTask({ title: "", estimated_hours: "", difficulty: "", deadline: "" });
      setAddingTask(false);
      onRefresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTask(taskId) {
    if (!confirm("이 할 일을 삭제할까요?")) return;
    try {
      await projectsApi.deleteTask(project.id, taskId);
      onRefresh();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleDeleteProject() {
    if (!confirm(`"${project.title}" 프로젝트를 삭제할까요?\n(모든 할 일이 삭제됩니다)`)) return;
    try {
      await projectsApi.delete(project.id);
      onRefresh();
    } catch (e) {
      alert(e.message);
    }
  }

  function openMemoEdit(task) {
    setEditingMemo(task.id);
    setMemoValue(task.memo ?? "");
  }

  async function handleSaveMemo(taskId) {
    try {
      await projectsApi.updateTask(project.id, taskId, { memo: memoValue });
      setEditingMemo(null);
      onRefresh();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleTwinnyFeedback() {
    setTwinnyLoading(true);
    setTwinnyResult(null);
    try {
      const result = await projectsApi.twinnyFeedback(project.id);
      setTwinnyResult(result);
    } catch (e) {
      alert(e.message);
    } finally {
      setTwinnyLoading(false);
    }
  }

  const deadlineLabel = project.deadline
    ? (() => {
        const days = stats.days_until_deadline;
        if (days === null || days === undefined) return null;
        if (days < 0) return <span className="gt-deadline-badge gt-deadline-past">마감 {Math.abs(days)}일 초과</span>;
        if (days === 0) return <span className="gt-deadline-badge gt-deadline-today">오늘 마감</span>;
        return <span className="gt-deadline-badge">{days}일 남음</span>;
      })()
    : null;

  return (
    <div className={`gt-project-card ${stats.momentum_drop ? "gt-momentum-drop" : ""}`}>
      <div className="gt-project-header" onClick={() => setExpanded((v) => !v)}>
        <div className="gt-project-title-row">
          <span className="gt-project-chevron">{expanded ? "▾" : "▸"}</span>
          <span className="gt-project-title">{project.title}</span>
          {stats.momentum_drop && (
            <span className="gt-momentum-badge">⚠️ 모멘텀 하락</span>
          )}
          {deadlineLabel}
        </div>
        <button
          className="gt-project-delete"
          onClick={(e) => { e.stopPropagation(); handleDeleteProject(); }}
        >
          ✕
        </button>
      </div>

      {/* 진척도 바 */}
      <div className="gt-stats-row">
        <div className="gt-progress-wrap">
          <div className="gt-progress-bar">
            <div
              className="gt-progress-fill"
              style={{ width: `${stats.completion_pct}%` }}
            />
          </div>
          <span className="gt-progress-label">{stats.completion_pct}% 완료</span>
        </div>
        {stats.deadline_pct !== null && stats.deadline_pct !== undefined && (
          <span className="gt-deadline-pct">
            현재 속도로 마감일까지 <strong>{stats.deadline_pct}%</strong> 예상
          </span>
        )}
      </div>

      {/* 상세 통계 */}
      <div className="gt-stats-chips">
        <span className="gt-stat-chip">
          할 일 {stats.done_tasks}/{stats.total_tasks}
        </span>
        {stats.total_estimated_hours && (
          <span className="gt-stat-chip">예상 {stats.total_estimated_hours}h</span>
        )}
        <span className="gt-stat-chip">
          페이스 {stats.pace_per_day.toFixed(2)}/일
        </span>
      </div>

      {expanded && (
        <>
          {/* 탭 버튼 */}
          <div className="gt-tab-bar">
            <button
              className={`gt-tab-btn${activeTab === "all" ? " active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              전체
            </button>
            <button
              className={`gt-tab-btn${activeTab === "log" ? " active" : ""}`}
              onClick={() => setActiveTab("log")}
            >
              기록
            </button>
          </div>

          {/* ─── [전체] 탭 ─────────────────────────────── */}
          {activeTab === "all" && (
            <>
              <ul className="gt-task-list">
                {project.tasks.length === 0 && (
                  <li className="gt-task-empty">할 일을 추가해보세요.</li>
                )}
                {project.tasks.map((task) => (
                  <li key={task.id} className={`gt-task-item ${task.is_done ? "gt-task-done" : ""}`}>
                    <label className="gt-task-check-label">
                      <input
                        type="checkbox"
                        checked={task.is_done}
                        onChange={() => toggleDone(task)}
                      />
                      <span className="gt-task-title">{task.title}</span>
                    </label>
                    <div className="gt-task-meta">
                      {task.deadline && (
                        <span className="gt-task-chip gt-task-deadline-chip">📅 {task.deadline}</span>
                      )}
                      {task.estimated_hours && (
                        <span className="gt-task-chip">{task.estimated_hours}h</span>
                      )}
                      {task.difficulty && (
                        <DifficultyDots value={task.difficulty} />
                      )}
                      <button
                        className="gt-task-memo-btn"
                        title="메모 편집"
                        onClick={() => editingMemo === task.id ? setEditingMemo(null) : openMemoEdit(task)}
                      >
                        📝
                      </button>
                      <button
                        className="gt-task-del"
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        ✕
                      </button>
                    </div>
                    {editingMemo !== task.id && task.memo && (
                      <div className="gt-task-memo-preview">{task.memo}</div>
                    )}
                    {editingMemo === task.id && (
                      <div className="gt-task-memo-edit">
                        <textarea
                          className="gt-task-memo-area"
                          placeholder="접근 방식, 사용할 도구, 참고 링크 등 메모..."
                          value={memoValue}
                          onChange={(e) => setMemoValue(e.target.value)}
                          rows={2}
                          autoFocus
                        />
                        <div className="gt-task-memo-actions">
                          <button className="btn btn-primary btn-sm" onClick={() => handleSaveMemo(task.id)}>저장</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingMemo(null)}>취소</button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {addingTask ? (
                <form className="gt-add-task-form" onSubmit={handleAddTask}>
                  <input
                    className="gt-input gt-input-title"
                    placeholder="할 일 제목"
                    value={newTask.title}
                    onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                    autoFocus
                  />
                  <div className="gt-add-task-row">
                    <input
                      className="gt-input gt-input-sm"
                      type="number"
                      placeholder="예상 시간 (h)"
                      min="0"
                      step="0.5"
                      value={newTask.estimated_hours}
                      onChange={(e) => setNewTask((p) => ({ ...p, estimated_hours: e.target.value }))}
                    />
                    <select
                      className="gt-input gt-input-sm"
                      value={newTask.difficulty}
                      onChange={(e) => setNewTask((p) => ({ ...p, difficulty: e.target.value }))}
                    >
                      <option value="">난이도</option>
                      {[1, 2, 3, 4, 5].map((d) => (
                        <option key={d} value={d}>{d} — {DIFFICULTY_LABELS[d]}</option>
                      ))}
                    </select>
                    <input
                      className="gt-input gt-input-sm"
                      type="date"
                      title="목표일"
                      value={newTask.deadline}
                      onChange={(e) => setNewTask((p) => ({ ...p, deadline: e.target.value }))}
                    />
                    <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
                      추가
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      onClick={() => setAddingTask(false)}
                    >
                      취소
                    </button>
                  </div>
                </form>
              ) : (
                <button className="gt-add-task-btn" onClick={() => setAddingTask(true)}>
                  + 할 일 추가
                </button>
              )}

              <div className="gt-twinny-section">
                {/* 슬리핑 상태 */}
                {twinnyResult?.sleeping ? (
                  <div className="gt-twinny-sleeping">
                    <img src="/assets/twinny/twinny_closed.png" className="gt-twinny-sleeping-img" alt="Twinny 수면 중" />
                    <div className="gt-twinny-sleeping-text">
                      <span className="gt-twinny-sleeping-title">Twinny가 자러 갈 시간이에요 🌙</span>
                      <span className="gt-twinny-sleeping-sub">
                        {twinnyResult.available_at
                          ? `${twinnyResult.available_at}에 다시 만나요!`
                          : "다음에 이용해주세요!"}
                      </span>
                      {twinnyResult.available_at && (
                        <span className="gt-twinny-sleeping-time">
                          이용 가능 시각: <strong>{twinnyResult.available_at}</strong>
                        </span>
                      )}
                    </div>
                    <button
                      className="gt-twinny-btn"
                      style={{ marginTop: "0.5rem" }}
                      onClick={() => setTwinnyResult(null)}
                    >
                      닫기
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className={`gt-twinny-btn${twinnyResult ? " gt-twinny-btn-active" : ""}`}
                      onClick={handleTwinnyFeedback}
                      disabled={twinnyLoading}
                    >
                      <img src="/assets/twinny/twinny_open.png" className="gt-twinny-avatar" alt="Twinny" />
                      <span>{twinnyLoading ? "Twinny 분석 중..." : "Twinny에게 물어보기"}</span>
                    </button>
                    {(twinnyLoading || twinnyResult) && (
                      <div className="gt-twinny-panel">
                        <TwinnyPanel
                          summaryText={twinnyResult?.summary_text ?? ""}
                          riskLevel={twinnyResult?.risk_level ?? "낮음"}
                          recommendations={twinnyResult?.recommendations ?? []}
                          evidence={twinnyResult?.evidence ?? []}
                          loading={twinnyLoading}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {/* ─── [기록] 탭 ─────────────────────────────── */}
          {activeTab === "log" && (() => {
            const startDate = new Date(project.created_at);
            startDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const deadlineDate = project.deadline
              ? new Date(project.deadline + "T00:00:00")
              : null;
            const msPerDay = 1000 * 60 * 60 * 24;
            const totalDays = deadlineDate
              ? Math.max(Math.round((deadlineDate - startDate) / msPerDay) + 1, 1)
              : null;
            const elapsedDays = Math.max(Math.round((today - startDate) / msPerDay) + 1, 1);

            // 태스크를 deadline 날짜별로 그룹
            const byDate = {};
            for (const task of project.tasks) {
              const key = task.deadline ?? "미정";
              if (!byDate[key]) byDate[key] = [];
              byDate[key].push(task);
            }
            const sortedDates = Object.keys(byDate)
              .filter((k) => k !== "미정")
              .sort();
            if (byDate["미정"]) sortedDates.push("미정");

            const todayStr = today.toISOString().slice(0, 10);

            return (
              <div className="gt-log-view">
                {/* 기간 헤더 */}
                <div className="gt-log-duration">
                  <div className="gt-log-duration-dates">
                    <span className="gt-log-elapsed-bold">
                      {startDate.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                    </span>
                    <span className="gt-log-duration-arrow">→</span>
                    {deadlineDate ? (
                      <span className="gt-log-elapsed-bold">
                        {deadlineDate.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                      </span>
                    ) : (
                      <span className="gt-log-elapsed">마감일 미정</span>
                    )}
                  </div>
                  <div className="gt-log-elapsed">
                    {totalDays
                      ? `총 ${totalDays}일 중 ${Math.min(elapsedDays, totalDays)}일째`
                      : `시작 후 ${elapsedDays}일째`}
                  </div>
                  {totalDays && (
                    <div className="gt-log-duration-bar">
                      <div
                        className="gt-log-duration-fill"
                        style={{ width: `${Math.min((elapsedDays / totalDays) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* 날짜별 태스크 */}
                {sortedDates.length === 0 ? (
                  <div className="gt-log-empty">태스크에 목표일을 설정하면 여기에 날별로 표시됩니다.</div>
                ) : (
                  sortedDates.map((dateKey) => {
                    const tasks = byDate[dateKey];
                    const isPast = dateKey !== "미정" && dateKey < todayStr;
                    const isToday = dateKey === todayStr;
                    const doneCnt = tasks.filter((t) => t.is_done).length;
                    const dayLabel =
                      dateKey === "미정"
                        ? "목표일 미정"
                        : new Date(dateKey + "T00:00:00").toLocaleDateString("ko-KR", {
                            month: "long",
                            day: "numeric",
                            weekday: "short",
                          });
                    return (
                      <div
                        key={dateKey}
                        className={`gt-log-day${isPast ? " gt-log-day-past" : ""}${isToday ? " gt-log-day-today" : ""}`}
                      >
                        <div className="gt-log-day-header">
                          <span className="gt-log-date">{dayLabel}</span>
                          <span className="gt-log-day-count">
                            {doneCnt}/{tasks.length} 완료
                          </span>
                          {isPast && doneCnt < tasks.length && (
                            <span className="gt-log-overdue-badge">미완료</span>
                          )}
                        </div>
                        <ul className="gt-log-task-list">
                          {tasks.map((task) => (
                            <li
                              key={task.id}
                              className={`gt-log-task-item${task.is_done ? " done" : ""}${isPast && !task.is_done ? " overdue" : ""}`}
                            >
                              <label className="gt-task-check-label">
                                <input
                                  type="checkbox"
                                  checked={task.is_done}
                                  onChange={() => toggleDone(task)}
                                />
                                <span className="gt-task-title">{task.title}</span>
                              </label>
                              {task.memo && (
                                <span className="gt-log-task-memo">💬 {task.memo}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

function GoalSection({ goal, projects, onRefresh }) {
  const [addingProject, setAddingProject] = useState(false);
  const [newProj, setNewProj] = useState({ title: "", description: "", deadline: "" });
  const [saving, setSaving] = useState(false);
  const goalProjects = projects.filter((p) => p.goal_id === goal.id);

  async function handleCreateProject(e) {
    e.preventDefault();
    if (!newProj.title.trim()) return;
    setSaving(true);
    try {
      await projectsApi.create({
        goal_id: goal.id,
        title: newProj.title.trim(),
        description: newProj.description.trim() || undefined,
        deadline: newProj.deadline || undefined,
      });
      setNewProj({ title: "", description: "", deadline: "" });
      setAddingProject(false);
      onRefresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="gt-goal-section">
      <div className="gt-goal-header">
        <span className="gt-goal-type">{GOAL_TYPE_LABELS[goal.type] || goal.type}</span>
        <span className="gt-goal-text">{goal.text}</span>
      </div>

      {goalProjects.length === 0 && !addingProject && (
        <div className="gt-no-projects">프로젝트가 없습니다.</div>
      )}

      {goalProjects.map((p) => (
        <ProjectCard key={p.id} project={p} onRefresh={onRefresh} />
      ))}

      {addingProject ? (
        <form className="gt-add-project-form" onSubmit={handleCreateProject}>
          <input
            className="gt-input"
            placeholder="프로젝트 이름"
            value={newProj.title}
            onChange={(e) => setNewProj((p) => ({ ...p, title: e.target.value }))}
            autoFocus
          />
          <input
            className="gt-input"
            placeholder="설명 (선택)"
            value={newProj.description}
            onChange={(e) => setNewProj((p) => ({ ...p, description: e.target.value }))}
          />
          <div className="gt-add-project-row">
            <label className="gt-label">
              마감일 (선택)
              <input
                className="gt-input gt-input-sm"
                type="date"
                value={newProj.deadline}
                onChange={(e) => setNewProj((p) => ({ ...p, deadline: e.target.value }))}
              />
            </label>
            <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
              생성
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => setAddingProject(false)}
            >
              취소
            </button>
          </div>
        </form>
      ) : (
        <button className="gt-add-project-btn" onClick={() => setAddingProject(true)}>
          + 프로젝트 추가
        </button>
      )}
    </div>
  );
}

export default function GoalTwinPage() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [freeProjects, setFreeProjects] = useState([]);

  const load = async () => {
    try {
      const [g, p] = await Promise.all([goalsApi.list(), projectsApi.list()]);
      setGoals(g);
      setProjects(p);
      // 목표와 연결되지 않은 프로젝트
      const goalIds = new Set(g.map((goal) => goal.id));
      setFreeProjects(p.filter((proj) => !proj.goal_id || !goalIds.has(proj.goal_id)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const [addingFreeProject, setAddingFreeProject] = useState(false);
  const [newFreeProj, setNewFreeProj] = useState({ title: "", description: "", deadline: "" });
  const [savingFree, setSavingFree] = useState(false);

  async function handleCreateFreeProject(e) {
    e.preventDefault();
    if (!newFreeProj.title.trim()) return;
    setSavingFree(true);
    try {
      await projectsApi.create({
        title: newFreeProj.title.trim(),
        description: newFreeProj.description.trim() || undefined,
        deadline: newFreeProj.deadline || undefined,
      });
      setNewFreeProj({ title: "", description: "", deadline: "" });
      setAddingFreeProject(false);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setSavingFree(false);
    }
  }

  return (
    <div className="app-layout">
      <header className="app-header">
        <button className="btn btn-ghost" onClick={() => navigate("/twin-lab")}>
          ← Twin Lab
        </button>
        <span className="app-header-logo" style={{ fontSize: "1rem" }}>
          Goal Twin
        </span>
        <button className="btn btn-ghost" onClick={() => navigate("/goals")}>
          목표 편집
        </button>
      </header>

      <div className="gt-main">
        {loading ? (
          <div className="gt-loading">불러오는 중...</div>
        ) : goals.length === 0 && projects.length === 0 ? (
          <div className="gt-empty-state">
            <div className="gt-empty-icon">🎯</div>
            <div className="gt-empty-text">아직 목표가 없어요.</div>
            <button className="btn btn-primary" onClick={() => navigate("/goals")}>
              목표 설정하기
            </button>
          </div>
        ) : (
          <>
            {/* 목표별 섹션 */}
            {goals.map((goal) => (
              <GoalSection
                key={goal.id}
                goal={goal}
                projects={projects}
                onRefresh={load}
              />
            ))}

            {/* 목표 없이 독립 프로젝트 */}
            {(freeProjects.length > 0 || addingFreeProject) && (
              <div className="gt-goal-section gt-goal-section-free">
                <div className="gt-goal-header">
                  <span className="gt-goal-text">기타 프로젝트</span>
                </div>
                {freeProjects.map((p) => (
                  <ProjectCard key={p.id} project={p} onRefresh={load} />
                ))}
                {addingFreeProject ? (
                  <form className="gt-add-project-form" onSubmit={handleCreateFreeProject}>
                    <input
                      className="gt-input"
                      placeholder="프로젝트 이름"
                      value={newFreeProj.title}
                      onChange={(e) => setNewFreeProj((p) => ({ ...p, title: e.target.value }))}
                      autoFocus
                    />
                    <input
                      className="gt-input"
                      placeholder="설명 (선택)"
                      value={newFreeProj.description}
                      onChange={(e) => setNewFreeProj((p) => ({ ...p, description: e.target.value }))}
                    />
                    <div className="gt-add-project-row">
                      <label className="gt-label">
                        마감일 (선택)
                        <input
                          className="gt-input gt-input-sm"
                          type="date"
                          value={newFreeProj.deadline}
                          onChange={(e) => setNewFreeProj((p) => ({ ...p, deadline: e.target.value }))}
                        />
                      </label>
                      <button className="btn btn-primary btn-sm" type="submit" disabled={savingFree}>
                        생성
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={() => setAddingFreeProject(false)}
                      >
                        취소
                      </button>
                    </div>
                  </form>
                ) : (
                  <button className="gt-add-project-btn" onClick={() => setAddingFreeProject(true)}>
                    + 프로젝트 추가
                  </button>
                )}
              </div>
            )}

            {/* 목표가 있고 독립 프로젝트가 없을 때도 추가 버튼 */}
            {freeProjects.length === 0 && !addingFreeProject && goals.length > 0 && (
              <button
                className="gt-add-free-project-btn"
                onClick={() => setAddingFreeProject(true)}
              >
                + 목표 없이 프로젝트 추가
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
