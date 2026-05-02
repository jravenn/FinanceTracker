
import { useState, useEffect, useCallback, useRef } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const T = {
  cream: "#FAF7F2",
  parchment: "#F2EDE4",
  sand: "#E8DFD0",
  linen: "#DDD4C4",
  walnut: "#8B6F47",
  bark: "#6B5230",
  espresso: "#3D2B1A",
  gold: "#C9A84C",
  goldLight: "#E8CC7A",
  text: "#2C1F0E",
  textMid: "#6B5A42",
  textLight: "#9B8A72",
  green: "#5C8C60",
  amber: "#C07A3A",
  red: "#B85450",
  white: "#FFFDF9",
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);

const fmtDec = (n) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(n || 0);

const now = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (key) => {
  const [y, m] = key.split("-");
  return new Date(+y, +m - 1).toLocaleString("en-GB", { month: "short", year: "2-digit" });
};

// ─── STORAGE HELPERS ──────────────────────────────────────────────────────────
const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

// ─── SCORE CALCULATOR ─────────────────────────────────────────────────────────
const calcScore = (monthData, allocs) => {
  if (!monthData || !allocs) return 0;
  let score = 100;
  const lifestyleSpent = monthData.expenses?.reduce((s, e) => s + e.amount, 0) || 0;
  const lifestyleTarget = (monthData.salary * allocs.lifestyle) / 100;
  const overSpend = lifestyleSpent - lifestyleTarget;
  if (overSpend > 0) score -= Math.min(30, Math.round((overSpend / lifestyleTarget) * 40));
  if (monthData.salary > 0) score = Math.max(0, score);
  else score = 0;
  return Math.min(100, Math.max(0, score));
};

// ─── INSIGHT GENERATOR ────────────────────────────────────────────────────────
const genInsights = (months, currentKey, allocs) => {
  const insights = [];
  const curr = months[currentKey];
  if (!curr || !curr.salary) return insights;

  const keys = Object.keys(months).sort();
  const prevKey = keys[keys.indexOf(currentKey) - 1];
  const prev = months[prevKey];

  const lifestyleSpent = curr.expenses?.reduce((s, e) => s + e.amount, 0) || 0;
  const lifestyleTarget = (curr.salary * allocs.lifestyle) / 100;
  const savingsTarget = (curr.salary * allocs.savings) / 100;

  if (lifestyleSpent > lifestyleTarget)
    insights.push({ type: "warn", icon: "⚠️", text: `Lifestyle spend is €${Math.round(lifestyleSpent - lifestyleTarget)} over budget this month.` });
  else if (lifestyleSpent > 0)
    insights.push({ type: "good", icon: "✅", text: `On track with lifestyle spending — €${Math.round(lifestyleTarget - lifestyleSpent)} remaining.` });

  if (prev && prev.salary > 0) {
    const prevSavingsRate = allocs.savings;
    const currSavingsRate = allocs.savings;
    if (currSavingsRate < prevSavingsRate)
      insights.push({ type: "warn", icon: "📉", text: "Your savings rate dropped compared to last month." });
    else
      insights.push({ type: "good", icon: "📈", text: "Savings rate is consistent. Keep it up!" });
  }

  // Streak check
  const streak = keys.slice(-3).filter((k) => {
    const m = months[k];
    return m && m.salary > 0;
  }).length;
  if (streak >= 3)
    insights.push({ type: "good", icon: "🔥", text: `${streak} months of consistent saving. Great discipline!` });

  if (curr.salary > 0 && lifestyleSpent === 0)
    insights.push({ type: "info", icon: "💡", text: "No expenses logged yet. Add some to see your real breakdown." });

  return insights;
};

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

const Card = ({ children, style = {}, className = "" }) => (
  <div
    className={className}
    style={{
      background: T.white,
      borderRadius: 20,
      padding: "24px",
      boxShadow: "0 2px 16px rgba(60,30,10,0.07), 0 1px 3px rgba(60,30,10,0.05)",
      border: `1px solid ${T.sand}`,
      transition: "box-shadow 0.2s ease, transform 0.2s ease",
      ...style,
    }}
  >
    {children}
  </div>
);

const Label = ({ children, style = {} }) => (
  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textLight, marginBottom: 6, fontFamily: "'DM Sans', sans-serif", ...style }}>
    {children}
  </div>
);

const Num = ({ children, size = 32, color = T.text }) => (
  <div style={{ fontSize: size, fontWeight: 700, color, fontFamily: "'Playfair Display', serif", lineHeight: 1.1 }}>{children}</div>
);

const Pill = ({ children, color = T.gold }) => (
  <span style={{ background: color + "22", color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, letterSpacing: "0.06em", fontFamily: "'DM Sans', sans-serif" }}>
    {children}
  </span>
);

const SliderRow = ({ label, value, onChange, color }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
      <span style={{ fontSize: 13, color: T.textMid, fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "'DM Sans', sans-serif" }}>{value}%</span>
    </div>
    <input
      type="range" min={0} max={100} value={value}
      onChange={(e) => onChange(+e.target.value)}
      style={{ width: "100%", accentColor: color, height: 4, cursor: "pointer" }}
    />
  </div>
);

const ProgressBar = ({ pct, color = T.gold }) => (
  <div style={{ background: T.sand, borderRadius: 999, height: 8, overflow: "hidden" }}>
    <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: color, borderRadius: 999, transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)" }} />
  </div>
);

const ScoreRing = ({ score }) => {
  const r = 42, circ = 2 * Math.PI * r;
  const color = score >= 80 ? T.green : score >= 55 ? T.gold : T.red;
  return (
    <svg width={110} height={110} style={{ display: "block" }}>
      <circle cx={55} cy={55} r={r} fill="none" stroke={T.sand} strokeWidth={8} />
      <circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
        strokeLinecap="round" transform="rotate(-90 55 55)"
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
      />
      <text x={55} y={52} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize={22} fontWeight={700} fontFamily="'Playfair Display', serif">{score}</text>
      <text x={55} y={68} textAnchor="middle" fill={T.textLight} fontSize={10} fontFamily="'DM Sans', sans-serif">/100</text>
    </svg>
  );
};

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [salary, setSalary] = useState(() => load("fz_salary", 3500));
  const [allocs, setAllocs] = useState(() => load("fz_allocs", { savings: 35, investments: 10, fixed: 43, lifestyle: 12 }));
  const [months, setMonths] = useState(() => load("fz_months", {}));
  const [goals, setGoals] = useState(() => load("fz_goals", []));
  const [currentMonth] = useState(now);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [expenseAmt, setExpenseAmt] = useState("");
  const [expenseCat, setExpenseCat] = useState("Food");
  const [expenseNote, setExpenseNote] = useState("");
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [newGoalPct, setNewGoalPct] = useState(50);
  const [toast, setToast] = useState(null);
  const [warnPending, setWarnPending] = useState(null);
  const [visibleSections, setVisibleSections] = useState(() =>
    load("fz_vis", { overview: true, goals: true, expenses: true, insights: true, score: true, history: true })
  );
  const [editingSalary, setEditingSalary] = useState(false);
  const [salaryInput, setSalaryInput] = useState(String(salary));

  // Persist
  useEffect(() => save("fz_salary", salary), [salary]);
  useEffect(() => save("fz_allocs", allocs), [allocs]);
  useEffect(() => save("fz_months", months), [months]);
  useEffect(() => save("fz_goals", goals), [goals]);
  useEffect(() => save("fz_vis", visibleSections), [visibleSections]);

  // Ensure current month exists
  useEffect(() => {
    if (!months[currentMonth]) {
      setMonths((m) => ({ ...m, [currentMonth]: { salary, expenses: [] } }));
    }
  }, [currentMonth]);

  // Recalc on salary change
  useEffect(() => {
    setMonths((m) => ({ ...m, [currentMonth]: { ...(m[currentMonth] || { expenses: [] }), salary } }));
  }, [salary]);

  const showToast = (msg, type = "good") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const totalAlloc = allocs.savings + allocs.investments + allocs.fixed + allocs.lifestyle;

  const calc = {
    savings: (salary * allocs.savings) / 100,
    investments: (salary * allocs.investments) / 100,
    fixed: (salary * allocs.fixed) / 100,
    lifestyle: (salary * allocs.lifestyle) / 100,
  };

  const currMonthData = months[currentMonth] || { salary, expenses: [] };
  const expenses = currMonthData.expenses || [];
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const score = calcScore(currMonthData, allocs);
  const insights = genInsights(months, currentMonth, allocs);

  const goalSavingsTotal = calc.savings;
  const goalPctTotal = goals.reduce((s, g) => s + g.pct, 0);

  // Accumulated savings per goal (sum across all months)
  const goalAccumulated = (goal) => {
    return Object.values(months).reduce((s, m) => {
      return s + ((m.salary * allocs.savings) / 100) * (goal.pct / 100);
    }, 0);
  };

  const addExpense = (override = false) => {
    const amt = parseFloat(expenseAmt);
    if (!amt || amt <= 0) return;
    const newTotal = totalExpenses + amt;
    const lifestyleTarget = calc.lifestyle;

    if (!override && newTotal > lifestyleTarget) {
      setWarnPending({ amt, cat: expenseCat, note: expenseNote });
      return;
    }

    const expense = { id: Date.now(), amount: amt, category: expenseCat, note: expenseNote, date: new Date().toISOString() };
    setMonths((m) => ({
      ...m,
      [currentMonth]: { ...m[currentMonth], expenses: [...(m[currentMonth]?.expenses || []), expense] },
    }));
    setExpenseAmt("");
    setExpenseNote("");
    setWarnPending(null);
    if (amt + totalExpenses >= lifestyleTarget) showToast("🎯 Lifestyle budget fully used!", "warn");
    else showToast("Expense added ✓");
  };

  const deleteExpense = (id) => {
    setMonths((m) => ({
      ...m,
      [currentMonth]: { ...m[currentMonth], expenses: m[currentMonth].expenses.filter((e) => e.id !== id) },
    }));
  };

  const addGoal = () => {
    if (!newGoalName || !newGoalTarget) return;
    if (goalPctTotal + newGoalPct > 100) { showToast("Goal %% exceeds 100% of savings!", "warn"); return; }
    setGoals((g) => [...g, { id: Date.now(), name: newGoalName, target: parseFloat(newGoalTarget), pct: newGoalPct }]);
    setNewGoalName(""); setNewGoalTarget(""); setNewGoalPct(50);
    showToast("Goal added 🎯");
  };

  const catColors = { Food: "#C9A84C", Transport: "#5C8C60", Shopping: "#8B6F47", Bills: "#B85450", Other: "#9B8A72" };
  const catData = ["Food", "Transport", "Shopping", "Bills", "Other"].map((cat) => ({
    name: cat,
    value: expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((d) => d.value > 0);

  const allocData = [
    { name: "Savings", value: allocs.savings, color: T.green },
    { name: "Invest", value: allocs.investments, color: T.gold },
    { name: "Fixed", value: allocs.fixed, color: T.walnut },
    { name: "Lifestyle", value: allocs.lifestyle, color: T.amber },
  ];

  const historyKeys = Object.keys(months).sort().slice(-6);

  const scoreLabel = score >= 85 ? "Excellent month 🌟" : score >= 70 ? "Strong month 💪" : score >= 50 ? "Decent, room to grow" : "Needs attention ⚠️";

  const toggleSection = (key) => setVisibleSections((v) => ({ ...v, [key]: !v[key] }));

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "◈" },
    { id: "goals", label: "Goals", icon: "◎" },
    { id: "expenses", label: "Expenses", icon: "◉" },
    { id: "settings", label: "Settings", icon: "◐" },
  ];

  const updateAlloc = (key, val) => {
    setAllocs((a) => ({ ...a, [key]: val }));
  };

  return (
    <>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${T.cream}; font-family: 'DM Sans', sans-serif; color: ${T.text}; }
        input[type=range] { -webkit-appearance: none; background: transparent; }
        input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 999px; background: ${T.linen}; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: currentColor; margin-top: -6px; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
        input[type=number] { -moz-appearance: textfield; }
        input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${T.linen}; border-radius: 2px; }
        .card-hover:hover { box-shadow: 0 6px 28px rgba(60,30,10,0.12), 0 2px 6px rgba(60,30,10,0.07) !important; transform: translateY(-1px); }
        .btn-primary { background: ${T.espresso}; color: ${T.cream}; border: none; border-radius: 12px; padding: 11px 22px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.18s ease; letter-spacing: 0.02em; }
        .btn-primary:hover { background: ${T.bark}; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(60,30,10,0.22); }
        .btn-secondary { background: transparent; color: ${T.textMid}; border: 1.5px solid ${T.linen}; border-radius: 12px; padding: 10px 20px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s ease; }
        .btn-secondary:hover { border-color: ${T.walnut}; color: ${T.walnut}; }
        .input-field { background: ${T.parchment}; border: 1.5px solid ${T.sand}; border-radius: 12px; padding: 11px 14px; font-family: 'DM Sans', sans-serif; font-size: 14px; color: ${T.text}; width: 100%; transition: border-color 0.15s ease; outline: none; }
        .input-field:focus { border-color: ${T.walnut}; background: ${T.white}; }
        select.input-field { cursor: pointer; }
        .nav-item { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 500; color: ${T.textMid}; transition: all 0.15s ease; border: none; background: transparent; width: 100%; text-align: left; }
        .nav-item:hover { background: ${T.parchment}; color: ${T.text}; }
        .nav-item.active { background: ${T.espresso}; color: ${T.cream}; }
        .expense-row:hover { background: ${T.parchment}; }
        .toggle-btn { background: none; border: none; cursor: pointer; font-size: 16px; color: ${T.textLight}; padding: 2px 6px; border-radius: 6px; transition: color 0.15s; }
        .toggle-btn:hover { color: ${T.walnut}; }
        @media (max-width: 768px) { .sidebar { display: none !important; } .main-grid { padding: 12px !important; } .bottom-nav { display: flex !important; } }
      `}</style>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: toast.type === "warn" ? T.amber : T.espresso,
          color: T.cream, padding: "12px 20px", borderRadius: 14,
          fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          animation: "slideIn 0.3s ease",
          maxWidth: 280,
        }}>
          {toast.msg}
        </div>
      )}

      {/* WARN MODAL */}
      {warnPending && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(45,30,15,0.5)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <Card style={{ maxWidth: 360, width: "100%" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Budget Warning</div>
            <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.6, marginBottom: 20 }}>
              Adding {fmt(warnPending.amt)} will push you <strong>{fmt(totalExpenses + warnPending.amt - calc.lifestyle)}</strong> over your lifestyle budget. Continue?
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setWarnPending(null)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => {
                setExpenseAmt(String(warnPending.amt));
                setExpenseCat(warnPending.cat);
                setExpenseNote(warnPending.note);
                addExpense(true);
              }}>Add Anyway</button>
            </div>
          </Card>
        </div>
      )}

      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* SIDEBAR */}
        <div className="sidebar" style={{ width: 220, background: T.white, borderRight: `1px solid ${T.sand}`, padding: "28px 16px", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: T.espresso }}>Fortuna</div>
            <div style={{ fontSize: 11, color: T.textLight, letterSpacing: "0.08em", marginTop: 2 }}>PERSONAL FINANCE</div>
          </div>

          <div style={{ fontSize: 10, color: T.textLight, letterSpacing: "0.1em", fontWeight: 700, marginBottom: 8, paddingLeft: 14 }}>NAVIGATE</div>
          {navItems.map((n) => (
            <button key={n.id} className={`nav-item ${activeSection === n.id ? "active" : ""}`} onClick={() => setActiveSection(n.id)}>
              <span style={{ fontSize: 16 }}>{n.icon}</span> {n.label}
            </button>
          ))}

          <div style={{ marginTop: "auto", padding: "16px 14px", background: T.parchment, borderRadius: 14 }}>
            <Label>This Month</Label>
            <Num size={22}>{fmt(salary)}</Num>
            <div style={{ fontSize: 12, color: T.textLight, marginTop: 2 }}>Net Salary</div>
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div className="main-grid" style={{ padding: "28px 24px", maxWidth: 900, margin: "0 auto" }}>

            {/* HEADER */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: T.espresso }}>
                  {activeSection === "dashboard" ? "Overview" : activeSection === "goals" ? "Savings Goals" : activeSection === "expenses" ? "Expense Tracker" : "Settings"}
                </div>
                <div style={{ fontSize: 13, color: T.textLight, marginTop: 2 }}>{monthLabel(currentMonth)} · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</div>
              </div>
              {activeSection === "dashboard" && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(visibleSections).map(([key, val]) => (
                    <button key={key} className="btn-secondary" style={{ padding: "6px 12px", fontSize: 11, background: val ? T.espresso : "transparent", color: val ? T.cream : T.textMid, borderColor: val ? T.espresso : T.linen }}
                      onClick={() => toggleSection(key)}>
                      {key}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── DASHBOARD ── */}
            {activeSection === "dashboard" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Salary Hero */}
                {visibleSections.overview && (
                  <Card className="card-hover">
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                      <div>
                        <Label>Monthly Net Salary</Label>
                        {editingSalary ? (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                            <span style={{ fontSize: 28, color: T.textLight, fontFamily: "'Playfair Display', serif" }}>€</span>
                            <input className="input-field" type="number" value={salaryInput} autoFocus
                              onChange={(e) => setSalaryInput(e.target.value)}
                              onBlur={() => { const v = parseFloat(salaryInput); if (v > 0) setSalary(v); setEditingSalary(false); }}
                              onKeyDown={(e) => { if (e.key === "Enter") { const v = parseFloat(salaryInput); if (v > 0) setSalary(v); setEditingSalary(false); } }}
                              style={{ width: 140, fontSize: 28, fontFamily: "'Playfair Display', serif", padding: "4px 10px" }}
                            />
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => { setSalaryInput(String(salary)); setEditingSalary(true); }}>
                            <Num size={36}>{fmt(salary)}</Num>
                            <span style={{ fontSize: 12, color: T.textLight, marginTop: 6 }}>tap to edit</span>
                          </div>
                        )}
                        <div style={{ marginTop: 8 }}><Pill color={totalAlloc === 100 ? T.green : T.amber}>{totalAlloc}% allocated</Pill></div>
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {[
                          { label: "Savings", val: calc.savings, color: T.green },
                          { label: "Investments", val: calc.investments, color: T.gold },
                          { label: "Fixed", val: calc.fixed, color: T.walnut },
                          { label: "Lifestyle", val: calc.lifestyle, color: T.amber },
                        ].map((item) => (
                          <div key={item.label} style={{ textAlign: "center", minWidth: 70 }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: item.color, fontFamily: "'Playfair Display', serif" }}>{fmt(item.val)}</div>
                            <div style={{ fontSize: 11, color: T.textLight, marginTop: 2 }}>{item.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Allocation bar */}
                    <div style={{ marginTop: 18, height: 8, borderRadius: 999, overflow: "hidden", display: "flex", gap: 2 }}>
                      {allocData.map((a) => (
                        <div key={a.name} style={{ flex: a.value, background: a.color, transition: "flex 0.5s ease" }} />
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                      {allocData.map((a) => (
                        <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: a.color }} />
                          <span style={{ fontSize: 11, color: T.textLight }}>{a.name} {a.value}%</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Score + Insights row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
                  {visibleSections.score && (
                    <Card className="card-hover">
                      <Label>Monthly Score</Label>
                      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
                        <ScoreRing score={score} />
                        <div>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: T.espresso }}>{scoreLabel}</div>
                          <div style={{ fontSize: 12, color: T.textLight, marginTop: 6, lineHeight: 1.5 }}>
                            Based on savings consistency, lifestyle spend & investment regularity.
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}

                  {visibleSections.insights && (
                    <Card className="card-hover" style={{ flex: 1 }}>
                      <Label>Smart Insights</Label>
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                        {insights.length === 0 && (
                          <div style={{ fontSize: 13, color: T.textLight }}>Enter salary data to see insights.</div>
                        )}
                        {insights.map((ins, i) => (
                          <div key={i} style={{
                            display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10,
                            background: ins.type === "good" ? T.green + "12" : ins.type === "warn" ? T.amber + "15" : T.parchment,
                          }}>
                            <span style={{ fontSize: 16 }}>{ins.icon}</span>
                            <span style={{ fontSize: 12, color: T.textMid, lineHeight: 1.5 }}>{ins.text}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>

                {/* Goals preview */}
                {visibleSections.goals && goals.length > 0 && (
                  <Card className="card-hover">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <Label style={{ marginBottom: 0 }}>Savings Goals</Label>
                      <button className="btn-secondary" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => setActiveSection("goals")}>Manage →</button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {goals.map((g) => {
                        const acc = goalAccumulated(g);
                        const pct = Math.min(100, (acc / g.target) * 100);
                        const monthly = goalSavingsTotal * (g.pct / 100);
                        return (
                          <div key={g.id}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{g.name}</div>
                              <div style={{ fontSize: 12, color: T.textLight }}>{fmt(acc)} / {fmt(g.target)}</div>
                            </div>
                            <ProgressBar pct={pct} color={pct >= 100 ? T.green : T.gold} />
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                              <span style={{ fontSize: 11, color: T.textLight }}>{Math.round(pct)}% complete</span>
                              <span style={{ fontSize: 11, color: T.textLight }}>+{fmt(monthly)}/mo</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* Expense chart */}
                {visibleSections.expenses && catData.length > 0 && (
                  <Card className="card-hover">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <Label style={{ marginBottom: 0 }}>Expense Breakdown</Label>
                      <Pill color={totalExpenses > calc.lifestyle ? T.red : T.green}>
                        {fmt(totalExpenses)} / {fmt(calc.lifestyle)}
                      </Pill>
                    </div>
                    <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                      <ResponsiveContainer width={160} height={160}>
                        <PieChart>
                          <Pie data={catData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                            {catData.map((d, i) => <Cell key={i} fill={catColors[d.name] || T.walnut} />)}
                          </Pie>
                          <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, borderRadius: 8, border: `1px solid ${T.sand}` }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                        {catData.map((d) => (
                          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 10, height: 10, borderRadius: 3, background: catColors[d.name] }} />
                            <div style={{ flex: 1, fontSize: 13 }}>{d.name}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Playfair Display', serif" }}>{fmt(d.value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                )}

                {/* History */}
                {visibleSections.history && historyKeys.length > 1 && (
                  <Card className="card-hover">
                    <Label>6-Month History</Label>
                    <ResponsiveContainer width="100%" height={120} style={{ marginTop: 12 }}>
                      <BarChart data={historyKeys.map((k) => ({ name: monthLabel(k), salary: months[k]?.salary || 0 }))}>
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.textLight, fontFamily: "'DM Sans', sans-serif" }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip formatter={(v) => fmt(v)} contentStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, borderRadius: 8, border: `1px solid ${T.sand}` }} />
                        <Bar dataKey="salary" fill={T.walnut} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                )}
              </div>
            )}

            {/* ── GOALS ── */}
            {activeSection === "goals" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <Card>
                  <Label>Add New Goal</Label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                    <input className="input-field" placeholder="Goal name (e.g. House Deposit)" value={newGoalName} onChange={(e) => setNewGoalName(e.target.value)} />
                    <input className="input-field" type="number" placeholder="Target € amount" value={newGoalTarget} onChange={(e) => setNewGoalTarget(e.target.value)} />
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <SliderRow label={`% of savings allocated to this goal`} value={newGoalPct} onChange={setNewGoalPct} color={T.gold} />
                    <div style={{ fontSize: 12, color: T.textLight }}>= {fmt((calc.savings * newGoalPct) / 100)}/month towards this goal</div>
                  </div>
                  <button className="btn-primary" style={{ marginTop: 14, width: "100%" }} onClick={addGoal}>Add Goal</button>
                </Card>

                {goals.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: T.textLight, fontSize: 14 }}>No goals yet. Add your first savings goal above.</div>
                )}

                {goals.map((g) => {
                  const acc = goalAccumulated(g);
                  const pct = Math.min(100, (acc / g.target) * 100);
                  const monthly = goalSavingsTotal * (g.pct / 100);
                  const monthsLeft = monthly > 0 ? Math.ceil((g.target - acc) / monthly) : "∞";
                  return (
                    <Card key={g.id} className="card-hover">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>{g.name}</div>
                          <div style={{ fontSize: 13, color: T.textLight, marginTop: 2 }}>Target: {fmt(g.target)}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {pct >= 100 && <Pill color={T.green}>Reached! 🎉</Pill>}
                          <button onClick={() => setGoals((gs) => gs.filter((x) => x.id !== g.id))}
                            style={{ background: "none", border: "none", color: T.textLight, cursor: "pointer", fontSize: 18, padding: "0 4px" }}>×</button>
                        </div>
                      </div>
                      <div style={{ margin: "16px 0" }}>
                        <ProgressBar pct={pct} color={pct >= 100 ? T.green : T.gold} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                        {[
                          { label: "Saved", val: fmt(acc) },
                          { label: "Monthly", val: fmt(monthly) },
                          { label: "Months Left", val: pct >= 100 ? "Done!" : monthsLeft },
                        ].map((s) => (
                          <div key={s.label} style={{ textAlign: "center", padding: "10px", background: T.parchment, borderRadius: 12 }}>
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700 }}>{s.val}</div>
                            <div style={{ fontSize: 11, color: T.textLight, marginTop: 2 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <SliderRow label={`Savings allocation: ${g.pct}%`} value={g.pct} color={T.gold}
                          onChange={(v) => setGoals((gs) => gs.map((x) => x.id === g.id ? { ...x, pct: v } : x))} />
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* ── EXPENSES ── */}
            {activeSection === "expenses" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <Card>
                  <Label>Quick Add Expense</Label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto", gap: 10, marginTop: 12, alignItems: "end", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 11, color: T.textLight, marginBottom: 5 }}>Amount (€)</div>
                      <input className="input-field" type="number" placeholder="0.00" value={expenseAmt}
                        onChange={(e) => setExpenseAmt(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addExpense()} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.textLight, marginBottom: 5 }}>Category</div>
                      <select className="input-field" value={expenseCat} onChange={(e) => setExpenseCat(e.target.value)}>
                        {["Food", "Transport", "Shopping", "Bills", "Other"].map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.textLight, marginBottom: 5 }}>Note (optional)</div>
                      <input className="input-field" placeholder="e.g. Groceries" value={expenseNote}
                        onChange={(e) => setExpenseNote(e.target.value)} />
                    </div>
                    <button className="btn-primary" style={{ height: 44 }} onClick={() => addExpense()}>Add +</button>
                  </div>
                  <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, color: T.textMid }}>
                      Spent: <strong style={{ fontFamily: "'Playfair Display', serif" }}>{fmt(totalExpenses)}</strong> of {fmt(calc.lifestyle)} lifestyle budget
                    </div>
                    <Pill color={totalExpenses > calc.lifestyle ? T.red : T.green}>
                      {totalExpenses > calc.lifestyle ? `€${Math.round(totalExpenses - calc.lifestyle)} over` : `€${Math.round(calc.lifestyle - totalExpenses)} left`}
                    </Pill>
                  </div>
                  <ProgressBar pct={(totalExpenses / calc.lifestyle) * 100} color={totalExpenses > calc.lifestyle ? T.red : T.gold} />
                </Card>

                {catData.length > 0 && (
                  <Card>
                    <Label>By Category</Label>
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                      {catData.map((d) => (
                        <div key={d.name}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
                              <span style={{ width: 10, height: 10, borderRadius: 3, background: catColors[d.name], display: "inline-block" }} />
                              {d.name}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "'Playfair Display', serif" }}>{fmt(d.value)}</span>
                          </div>
                          <ProgressBar pct={(d.value / totalExpenses) * 100} color={catColors[d.name]} />
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                <Card>
                  <Label>Transaction History</Label>
                  {expenses.length === 0 && <div style={{ fontSize: 13, color: T.textLight, padding: "16px 0" }}>No expenses logged this month.</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
                    {[...expenses].reverse().map((e) => (
                      <div key={e.id} className="expense-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 10px", borderRadius: 10, transition: "background 0.15s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: catColors[e.category] + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                            {e.category === "Food" ? "🍽" : e.category === "Transport" ? "🚗" : e.category === "Shopping" ? "🛍" : e.category === "Bills" ? "📄" : "💼"}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{e.note || e.category}</div>
                            <div style={{ fontSize: 11, color: T.textLight }}>{e.category} · {new Date(e.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700 }}>{fmt(e.amount)}</div>
                          <button onClick={() => deleteExpense(e.id)} style={{ background: "none", border: "none", color: T.textLight, cursor: "pointer", fontSize: 16 }}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* ── SETTINGS ── */}
            {activeSection === "settings" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <Card>
                  <Label>Monthly Net Salary</Label>
                  <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
                    <input className="input-field" type="number" value={salary}
                      onChange={(e) => { const v = parseFloat(e.target.value); if (v > 0) setSalary(v); }}
                      style={{ fontSize: 20, fontFamily: "'Playfair Display', serif", maxWidth: 200 }} />
                    <span style={{ fontSize: 14, color: T.textLight }}>EUR / month</span>
                  </div>
                </Card>

                <Card>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <Label style={{ marginBottom: 0 }}>Budget Allocations</Label>
                    <Pill color={totalAlloc === 100 ? T.green : T.red}>{totalAlloc}% / 100%</Pill>
                  </div>
                  <SliderRow label="Savings" value={allocs.savings} onChange={(v) => updateAlloc("savings", v)} color={T.green} />
                  <SliderRow label="Investments" value={allocs.investments} onChange={(v) => updateAlloc("investments", v)} color={T.gold} />
                  <SliderRow label="Fixed Expenses" value={allocs.fixed} onChange={(v) => updateAlloc("fixed", v)} color={T.walnut} />
                  <SliderRow label="Lifestyle" value={allocs.lifestyle} onChange={(v) => updateAlloc("lifestyle", v)} color={T.amber} />
                  {totalAlloc !== 100 && (
                    <div style={{ marginTop: 10, fontSize: 12, color: T.red, background: T.red + "15", padding: "8px 12px", borderRadius: 8 }}>
                      Allocations must total 100%. Currently {totalAlloc}%.
                    </div>
                  )}
                  <div style={{ marginTop: 16, padding: "12px 14px", background: T.parchment, borderRadius: 12 }}>
                    <div style={{ fontSize: 12, color: T.textLight, marginBottom: 8 }}>With current salary {fmt(salary)}:</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        { label: "Savings", val: calc.savings, color: T.green },
                        { label: "Investments", val: calc.investments, color: T.gold },
                        { label: "Fixed Expenses", val: calc.fixed, color: T.walnut },
                        { label: "Lifestyle", val: calc.lifestyle, color: T.amber },
                      ].map((r) => (
                        <div key={r.label} style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: T.textMid }}>{r.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{fmt(r.val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                <Card>
                  <Label>Yearly Projection</Label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
                    {[
                      { label: "Annual Salary", val: salary * 12 },
                      { label: "Annual Savings", val: calc.savings * 12 },
                      { label: "Annual Investments", val: calc.investments * 12 },
                      { label: "Total Saved", val: (calc.savings + calc.investments) * 12 },
                    ].map((r) => (
                      <div key={r.label} style={{ padding: "14px", background: T.parchment, borderRadius: 12 }}>
                        <div style={{ fontSize: 11, color: T.textLight, marginBottom: 4 }}>{r.label}</div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>{fmt(r.val)}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <Label>Data Management</Label>
                  <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                    <button className="btn-secondary" onClick={() => {
                      if (confirm("Reset all data? This cannot be undone.")) {
                        ["fz_salary","fz_allocs","fz_months","fz_goals","fz_vis"].forEach(k => localStorage.removeItem(k));
                        window.location.reload();
                      }
                    }}>Reset All Data</button>
                    <button className="btn-secondary" onClick={() => {
                      const data = { salary, allocs, months, goals };
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "fortuna-backup.json"; a.click();
                    }}>Export Backup</button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM NAV (mobile) */}
      <div className="bottom-nav" style={{ display: "none", position: "fixed", bottom: 0, left: 0, right: 0, background: T.white, borderTop: `1px solid ${T.sand}`, padding: "8px 0", zIndex: 100, justifyContent: "space-around" }}>
        {navItems.map((n) => (
          <button key={n.id} onClick={() => setActiveSection(n.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "4px 12px", color: activeSection === n.id ? T.espresso : T.textLight }}>
            <span style={{ fontSize: 20 }}>{n.icon}</span>
            <span style={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif", fontWeight: activeSection === n.id ? 700 : 400 }}>{n.label}</span>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </>
  );
}
