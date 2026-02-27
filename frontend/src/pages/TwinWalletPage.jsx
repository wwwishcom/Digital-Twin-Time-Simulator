import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { transactionsApi } from "../api/client";

// ── 카테고리 정의 ─────────────────────────────────────────────────────────────
const CATEGORIES = {
  expense: ["식비", "카페", "교통", "쇼핑", "의료", "문화/오락", "교육", "통신", "구독", "기타"],
  income:  ["월급", "용돈", "알바", "부업", "보너스", "기타"],
  investment: ["주식", "암호화폐", "펀드", "저금", "부동산", "기타"],
};

const TYPE_META = {
  income:     { label: "소득",  icon: "💚", color: "#d1fae5", textColor: "#065f46" },
  expense:    { label: "지출",  icon: "🔴", color: "#fee2e2", textColor: "#991b1b" },
  investment: { label: "투자",  icon: "📈", color: "#dbeafe", textColor: "#1e40af" },
};

function formatAmt(n) {
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, "")}만`;
  return n.toLocaleString();
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month - 1, 1).getDay(); // 0=일 ~ 6=토
}

const TODAY = new Date();

export default function TwinWalletPage() {
  const navigate = useNavigate();
  const [year, setYear] = useState(TODAY.getFullYear());
  const [month, setMonth] = useState(TODAY.getMonth() + 1);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // 모달 form state
  const [form, setForm] = useState({ type: "expense", amount: "", category: "", memo: "" });

  const dateStr = (d) => `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  // ── 데이터 로드 ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [txs, sum] = await Promise.all([
        transactionsApi.list(year, month),
        transactionsApi.summary(year, month),
      ]);
      setTransactions(txs);
      setSummary(sum);
    } catch {
      setTransactions([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  // ── 월 이동 ─────────────────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  }

  // ── 트랜잭션 추가 ────────────────────────────────────────────────────────────
  async function handleAdd(e) {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return;
    try {
      await transactionsApi.create({
        type: form.type,
        date: selectedDate,
        amount: amt,
        category: form.category || null,
        memo: form.memo || null,
      });
      setShowModal(false);
      setForm({ type: "expense", amount: "", category: "", memo: "" });
      await load();
    } catch {}
  }

  async function handleDelete(id) {
    try {
      await transactionsApi.delete(id);
      await load();
    } catch {}
  }

  // ── 날짜별 집계 ─────────────────────────────────────────────────────────────
  const byDate = {};
  transactions.forEach((tx) => {
    if (!byDate[tx.date]) byDate[tx.date] = { income: 0, expense: 0, investment: 0 };
    byDate[tx.date][tx.type] += tx.amount;
  });

  const selectedDateTxs = selectedDate
    ? transactions.filter((tx) => tx.date === selectedDate)
    : [];

  // ── 카테고리 비율 (지출) ────────────────────────────────────────────────────
  const expenseCats = summary?.expense_by_category || {};
  const totalExpense = summary?.total_expense || 0;
  const catEntries = Object.entries(expenseCats).sort((a, b) => b[1] - a[1]);

  // ── 달력 렌더 ───────────────────────────────────────────────────────────────
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const calCells = [];
  for (let i = 0; i < firstDay; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(d);

  const todayStr = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}-${String(TODAY.getDate()).padStart(2, "0")}`;

  return (
    <div className="app-layout">
      <header className="app-header">
        <button className="btn btn-ghost" onClick={() => navigate("/")}>← 홈</button>
        <span className="app-header-logo" style={{ fontSize: "1rem" }}>💰 Twin Wallet</span>
        <div style={{ width: 60 }} />
      </header>

      <div className="wallet-main">

        {/* ── 월 네비게이션 ── */}
        <div className="wallet-month-nav">
          <button className="btn btn-ghost btn-sm" onClick={prevMonth}>‹</button>
          <span className="wallet-month-label">{year}년 {month}월</span>
          <button className="btn btn-ghost btn-sm" onClick={nextMonth}>›</button>
        </div>

        {/* ── 월별 요약 ── */}
        <div className="wallet-summary-row">
          <div className="wallet-summary-card income">
            <div className="wallet-sum-label">총 소득</div>
            <div className="wallet-sum-value">+{formatAmt(summary?.total_income ?? 0)}</div>
          </div>
          <div className="wallet-summary-card expense">
            <div className="wallet-sum-label">총 지출</div>
            <div className="wallet-sum-value">-{formatAmt(summary?.total_expense ?? 0)}</div>
          </div>
          <div className="wallet-summary-card investment">
            <div className="wallet-sum-label">총 투자</div>
            <div className="wallet-sum-value">{formatAmt(summary?.total_investment ?? 0)}</div>
          </div>
          <div className="wallet-summary-card net">
            <div className="wallet-sum-label">순 저축</div>
            <div className={`wallet-sum-value ${(summary?.net_savings ?? 0) >= 0 ? "positive" : "negative"}`}>
              {(summary?.net_savings ?? 0) >= 0 ? "+" : ""}{formatAmt(summary?.net_savings ?? 0)}
            </div>
          </div>
        </div>

        {/* ── 캘린더 ── */}
        <div className="wallet-calendar">
          <div className="wallet-cal-header">
            {["일", "월", "화", "수", "목", "금", "토"].map(d => (
              <div key={d} className="wallet-cal-dow">{d}</div>
            ))}
          </div>
          <div className="wallet-cal-grid">
            {calCells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} className="wallet-cal-cell empty" />;
              const ds = dateStr(day);
              const info = byDate[ds];
              const isToday = ds === todayStr;
              const isSelected = ds === selectedDate;
              return (
                <button
                  key={ds}
                  className={`wallet-cal-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedDate(isSelected ? null : ds)}
                >
                  <span className="wallet-cal-day">{day}</span>
                  {info && (
                    <div className="wallet-cal-dots">
                      {info.income > 0 && <span className="dot dot-income" title={`+${formatAmt(info.income)}`} />}
                      {info.expense > 0 && <span className="dot dot-expense" title={`-${formatAmt(info.expense)}`} />}
                      {info.investment > 0 && <span className="dot dot-invest" title={formatAmt(info.investment)} />}
                    </div>
                  )}
                  {info?.expense > 0 && (
                    <span className="wallet-cal-amount">-{formatAmt(info.expense)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 선택된 날 트랜잭션 ── */}
        {selectedDate && (
          <div className="wallet-day-section">
            <div className="wallet-day-header">
              <span className="wallet-day-title">
                {parseInt(selectedDate.split("-")[2])}일 내역
              </span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setForm({ type: "expense", amount: "", category: "", memo: "" }); setShowModal(true); }}
              >
                + 추가
              </button>
            </div>
            {selectedDateTxs.length === 0 ? (
              <p className="wallet-empty">내역이 없습니다. 추가해보세요!</p>
            ) : (
              <div className="wallet-tx-list">
                {selectedDateTxs.map((tx) => (
                  <div key={tx.id} className="wallet-tx-item">
                    <span className="wallet-tx-type-icon">{TYPE_META[tx.type]?.icon}</span>
                    <div className="wallet-tx-info">
                      <span className="wallet-tx-category">{tx.category || TYPE_META[tx.type]?.label}</span>
                      {tx.memo && <span className="wallet-tx-memo">{tx.memo}</span>}
                    </div>
                    <span className={`wallet-tx-amount ${tx.type}`}>
                      {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                      {tx.amount.toLocaleString()}원
                    </span>
                    <button className="wallet-tx-delete" onClick={() => handleDelete(tx.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 지출 카테고리 분석 ── */}
        {catEntries.length > 0 && (
          <div className="wallet-category-section">
            <h4 className="wallet-section-title">이번 달 지출 분석</h4>
            <div className="wallet-cat-list">
              {catEntries.map(([cat, amt]) => {
                const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
                return (
                  <div key={cat} className="wallet-cat-item">
                    <div className="wallet-cat-name-row">
                      <span className="wallet-cat-name">{cat}</span>
                      <span className="wallet-cat-amount">{amt.toLocaleString()}원 ({pct}%)</span>
                    </div>
                    <div className="wallet-cat-bar-bg">
                      <div className="wallet-cat-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* ── 추가 모달 ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="wallet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wallet-modal-header">
              <span className="wallet-modal-title">
                {selectedDate?.split("-").slice(1).map(Number).join("/")} 내역 추가
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form className="wallet-modal-form" onSubmit={handleAdd} noValidate>
              {/* 유형 선택 */}
              <div className="wallet-type-row">
                {Object.entries(TYPE_META).map(([k, m]) => (
                  <button
                    key={k}
                    type="button"
                    className={`wallet-type-btn ${form.type === k ? "active" : ""}`}
                    style={{ "--type-color": m.color, "--type-text": m.textColor }}
                    onClick={() => setForm(f => ({ ...f, type: k, category: "" }))}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>

              {/* 금액 */}
              <div className="wallet-form-field">
                <label>금액 (원)</label>
                <input
                  type="number"
                  className="log-input"
                  min={1}
                  step={100}
                  required
                  placeholder="예: 15000"
                  value={form.amount}
                  onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>

              {/* 카테고리 */}
              <div className="wallet-form-field">
                <label>카테고리</label>
                <select
                  className="log-input"
                  value={form.category}
                  onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  <option value="">선택 (선택사항)</option>
                  {(CATEGORIES[form.type] || []).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* 메모 */}
              <div className="wallet-form-field">
                <label>메모 (선택)</label>
                <input
                  type="text"
                  className="log-input"
                  placeholder="간단한 메모..."
                  value={form.memo}
                  onChange={(e) => setForm(f => ({ ...f, memo: e.target.value }))}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                저장
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
