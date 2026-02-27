import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../api/client";
import TaskModal from "../components/TaskModal";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTHS = [
  "1월","2월","3월","4월","5월","6월",
  "7월","8월","9월","10월","11월","12월",
];
const CATEGORY_CHIP = {
  general:  { bg: "#ede9fe", text: "#7c3aed" },
  work:     { bg: "#dbeafe", text: "#1d4ed8" },
  personal: { bg: "#fce7f3", text: "#be185d" },
  health:   { bg: "#d1fae5", text: "#065f46" },
  study:    { bg: "#fef3c7", text: "#92400e" },
};
const CATEGORY_COLORS = {
  general:  "#a78bfa",
  work:     "#60a5fa",
  personal: "#f472b6",
  health:   "#34d399",
  study:    "#fbbf24",
};
const STATUS_LABELS = { planned: "예정", in_progress: "진행중", done: "완료" };

function pad(n) { return String(n).padStart(2, "0"); }
function formatTime(dt) {
  const d = new Date(dt);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatDate(d) {
  return `${d.getFullYear()}년 ${MONTHS[d.getMonth()]} ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

function toDateStr(dt) {
  const d = new Date(dt);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isMultiDay(task) {
  return toDateStr(task.start_at) !== toDateStr(task.end_at);
}

// 겹치는 바끼리 다른 row에 배치 (packing algorithm)
function packBars(bars) {
  const result = [];
  for (const bar of bars) {
    let row = 1;
    while (result.some(b => b.row === row && b.startCol < bar.endCol && b.endCol > bar.startCol)) {
      row++;
    }
    result.push({ ...bar, row });
  }
  return result;
}

export default function CalendarPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const [viewDate, setViewDate]     = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [tasks, setTasks]           = useState([]);
  const [modal, setModal]           = useState({ open: false, task: null, defaultDate: null });

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const fetchTasks = async () => {
    try { setTasks(await apiFetch("/tasks")); }
    catch (err) { console.error(err); }
  };
  useEffect(() => { fetchTasks(); }, []);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  // 달력 날짜 배열 → 주 단위로 분할
  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calDays = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calDays.length % 7 !== 0) calDays.push(null);

  const weeks = [];
  for (let i = 0; i < calDays.length; i += 7) {
    weeks.push(calDays.slice(i, i + 7));
  }

  const isToday    = (d) => d && today.getFullYear()===year && today.getMonth()===month && today.getDate()===d;
  const isSelected = (d) => d && selectedDate.getFullYear()===year && selectedDate.getMonth()===month && selectedDate.getDate()===d;

  // 특정 주에서 다일 이벤트 바 계산
  function getMultiDayBars(weekDays) {
    const multiTasks = tasks.filter(isMultiDay);
    const bars = [];

    for (const task of multiTasks) {
      const taskStart = new Date(task.start_at);
      const taskEnd   = new Date(task.end_at);
      taskStart.setHours(0, 0, 0, 0);
      taskEnd.setHours(23, 59, 59, 999);

      let startCol = -1, endCol = -1;
      for (let col = 0; col < 7; col++) {
        const d = weekDays[col];
        if (!d) continue;
        const cellDate = new Date(year, month, d);
        if (cellDate >= taskStart && cellDate <= taskEnd) {
          if (startCol === -1) startCol = col;
          endCol = col;
        }
      }
      if (startCol !== -1) {
        bars.push({ task, startCol: startCol + 1, endCol: endCol + 2 });
      }
    }

    return packBars(bars);
  }

  // 단일 날짜 칩 (다일 이벤트 제외)
  function getSingleDayTasksForDay(d) {
    if (!d) return [];
    return tasks.filter(t => {
      if (isMultiDay(t)) return false;
      const td = new Date(t.start_at);
      return td.getFullYear() === year && td.getMonth() === month && td.getDate() === d;
    });
  }

  // 선택된 날 사이드바: 단일 + 다일 모두 포함
  const selectedDayTasks = tasks
    .filter(t => {
      const sel     = selectedDate;
      const selDate = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate());
      const tStart  = new Date(new Date(t.start_at).getFullYear(), new Date(t.start_at).getMonth(), new Date(t.start_at).getDate());
      const tEnd    = new Date(new Date(t.end_at).getFullYear(),   new Date(t.end_at).getMonth(),   new Date(t.end_at).getDate());
      return tStart <= selDate && selDate <= tEnd;
    })
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));

  const openAdd  = () => setModal({ open: true, task: null, defaultDate: selectedDate });
  const openEdit = (task) => setModal({ open: true, task, defaultDate: null });
  const closeModal = () => setModal({ open: false, task: null, defaultDate: null });

  return (
    <div className="app-layout">
      <header className="app-header">
        <button className="app-header-logo" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => navigate("/")}>
          <img src="/assets/twinny/twinny_open.png" className="header-logo-img" alt="" />
          Twin Time
        </button>
        <button className="btn btn-ghost" onClick={logout}>로그아웃</button>
      </header>

      <div className="app-main">
        <section className="cal-section">
          <div className="cal-topbar">
            <div className="cal-nav">
              <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
              <span className="cal-month-title">{year}년 {MONTHS[month]}</span>
              <button className="cal-nav-btn" onClick={nextMonth}>›</button>
            </div>
          </div>

          <div className="cal-grid-wrap">
            {/* 요일 헤더 */}
            <div className="cal-weekday-row">
              {WEEKDAYS.map((w, i) => (
                <div
                  key={w}
                  className="cal-weekday-cell"
                  style={{ color: i===0 ? "#ef4444" : i===6 ? "#3b82f6" : undefined }}
                >
                  {w}
                </div>
              ))}
            </div>

            {/* 주 단위 렌더링 */}
            {weeks.map((weekDays, wi) => {
              const bars = getMultiDayBars(weekDays);
              const maxRow = bars.reduce((m, b) => Math.max(m, b.row), 0);
              const BAR_H = 22;
              const DAY_NUM_H = 32; // 날짜 숫자 영역 높이 (absolute 기준)

              return (
                <div key={wi} className="cal-week">
                  {/* 다일 이벤트 바 — 날짜 칸 안에 절대 위치로 배치 */}
                  {bars.map((bar, bi) => {
                    const chip = CATEGORY_CHIP[bar.task.category] || CATEGORY_CHIP.general;
                    return (
                      <div
                        key={bi}
                        className="cal-multiday-bar"
                        style={{
                          top: `${DAY_NUM_H + (bar.row - 1) * BAR_H}px`,
                          left: `calc(${((bar.startCol - 1) / 7) * 100}% + 1px)`,
                          width: `calc(${((bar.endCol - bar.startCol) / 7) * 100}% - 3px)`,
                          background: chip.bg,
                          color: chip.text,
                        }}
                        onClick={(e) => { e.stopPropagation(); openEdit(bar.task); }}
                      >
                        {bar.task.title}
                      </div>
                    );
                  })}

                  {/* 날짜 셀 */}
                  <div className="cal-week-days">
                    {weekDays.map((d, col) => {
                      const dayTasks = getSingleDayTasksForDay(d);
                      const classes  = [
                        "cal-day",
                        !d            ? "cal-day-empty" : "",
                        isToday(d)    ? "today"         : "",
                        isSelected(d) ? "selected"      : "",
                        d && col===0  ? "sunday"        : "",
                        d && col===6  ? "saturday"      : "",
                      ].filter(Boolean).join(" ");

                      return (
                        <div
                          key={col}
                          className={classes}
                          style={maxRow > 0 ? { paddingTop: `${DAY_NUM_H + maxRow * BAR_H + 2}px` } : undefined}
                          onClick={() => d && setSelectedDate(new Date(year, month, d))}
                        >
                          {d && (
                            <>
                              <span className="cal-day-num">{d}</span>
                              {dayTasks.slice(0, 2).map((t, i) => (
                                <div
                                  key={i}
                                  className="cal-task-chip"
                                  style={{
                                    background: (CATEGORY_CHIP[t.category] || CATEGORY_CHIP.general).bg,
                                    color:      (CATEGORY_CHIP[t.category] || CATEGORY_CHIP.general).text,
                                  }}
                                >
                                  {t.title}
                                </div>
                              ))}
                              {dayTasks.length > 2 && (
                                <div className="cal-more">+{dayTasks.length - 2}개 더</div>
                              )}
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
        </section>

        {/* 사이드바 */}
        <aside className="task-sidebar">
          <div className="sidebar-header">
            <div className="sidebar-date">{formatDate(selectedDate)}</div>
            <button className="btn btn-primary" onClick={openAdd}>+ 추가</button>
          </div>

          <div className="task-scroll">
            {selectedDayTasks.length === 0 ? (
              <div className="task-empty">
                일정이 없습니다.<br />
                <br />
                <strong>+ 추가</strong> 버튼으로<br />새 일정을 만들어보세요.
              </div>
            ) : (
              selectedDayTasks.map((task) => (
                <div
                  key={task.id}
                  className="task-card"
                  style={{ borderLeftColor: CATEGORY_COLORS[task.category] || "#6366f1" }}
                  onClick={() => openEdit(task)}
                >
                  <div className="task-card-title">
                    {task.title}
                    {isMultiDay(task) && <span className="task-multiday-badge">다일</span>}
                  </div>
                  <div className="task-card-meta">
                    <span>{formatTime(task.start_at)} – {formatTime(task.end_at)}</span>
                    <span className={`task-badge badge-${task.status}`}>
                      {STATUS_LABELS[task.status] || task.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {modal.open && (
        <TaskModal
          task={modal.task}
          defaultDate={modal.defaultDate || selectedDate}
          onClose={closeModal}
          onSave={fetchTasks}
        />
      )}
    </div>
  );
}
