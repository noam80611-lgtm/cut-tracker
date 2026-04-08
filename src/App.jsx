import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const STORAGE_KEY = "cut-tracker-v3";

const USER = {
  height: 168,
  tdee: 2500,
  calorieTarget: 1950,
  proteinTarget: 160,
  startWeight: 64,
};

const TRAIN_TYPES = [
  { id: "push", label: "Push", emoji: "🔺", color: "#e11d48" },
  { id: "pull", label: "Pull", emoji: "🔻", color: "#7c3aed" },
  { id: "legs", label: "Legs", emoji: "🦵", color: "#d97706" },
  { id: "cardio", label: "Cardio", emoji: "🏃", color: "#0891b2" },
  { id: "rest", label: "Rest", emoji: "😴", color: "#94a3b8" },
];

const defaultData = {
  dailyLogs: {},
  weeklyLogs: {},
  goals: {
    calories: USER.calorieTarget,
    protein: USER.proteinTarget,
    tdee: USER.tdee,
    targetWeight: USER.startWeight,
  },
};

function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}
function getWeekKey(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split("T")[0];
}
function formatShort(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
function formatWeekRange(dateStr) {
  const s = new Date(dateStr + "T12:00:00");
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return `${s.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
function calcBMI(weight, height) {
  return (weight / (height / 100) ** 2).toFixed(1);
}

// ── UI PRIMITIVES ────────────────────────────────────────────────

function Ring({ value, max, color, size = 60, stroke = 5 }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(value / max, 0), 1);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#f0f0ee"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(.4,0,.2,1)" }}
      />
    </svg>
  );
}

function NumInput({ label, value, onChange, unit, placeholder = "0" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: "#9ca3af",
          textTransform: "uppercase",
        }}
      >
        {label}
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "white",
          border: "1.5px solid #ebebeb",
          borderRadius: 10,
          padding: "9px 12px",
          gap: 6,
        }}
      >
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: 15,
            fontFamily: "inherit",
            fontWeight: 600,
            color: "#111",
            background: "transparent",
          }}
        />
        {unit && (
          <span style={{ fontSize: 11, color: "#c0bdb8", fontWeight: 600 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function Chip({ label, emoji, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "7px 13px",
        borderRadius: 20,
        border: active ? "none" : "1.5px solid #e5e5e5",
        background: active ? color : "white",
        color: active ? "white" : "#666",
        fontSize: 13,
        fontFamily: "inherit",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.15s",
        boxShadow: active ? `0 2px 8px ${color}44` : "none",
      }}
    >
      {emoji && <span>{emoji}</span>} {label}
    </button>
  );
}

function Toggle({ label, checked, onChange, color = "#111" }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: checked ? "#f0fdf4" : "white",
        border: `1.5px solid ${checked ? "#bbf7d0" : "#ebebeb"}`,
        borderRadius: 12,
        padding: "12px 14px",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>
        {label}
      </span>
      <div
        style={{
          width: 42,
          height: 24,
          borderRadius: 12,
          background: checked ? color : "#e5e5e5",
          position: "relative",
          transition: "background 0.2s",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 21 : 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "white",
            transition: "left 0.2s",
            boxShadow: "0 1px 4px #0002",
          }}
        />
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: "#b0ada8",
        textTransform: "uppercase",
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: "white",
        border: "1.5px solid #f0f0ee",
        borderRadius: 14,
        padding: "14px 16px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label, suffix = "" }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: "white",
          border: "1.5px solid #ebebeb",
          borderRadius: 10,
          padding: "8px 12px",
          fontSize: 12,
          fontWeight: 600,
          color: "#333",
          boxShadow: "0 4px 16px #0001",
        }}
      >
        <div style={{ color: "#999", marginBottom: 3 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }}>
            {p.name}: {p.value}
            {suffix}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// ── DAILY VIEW ───────────────────────────────────────────────────
function DailyView({ data, setData }) {
  const todayKey = getTodayKey();
  const [date, setDate] = useState(todayKey);
  const log = data.dailyLogs[date] || {};
  const { goals } = data;

  function setLog(field, val) {
    setData((prev) => ({
      ...prev,
      dailyLogs: {
        ...prev.dailyLogs,
        [date]: { ...prev.dailyLogs[date], [field]: val },
      },
    }));
  }

  const cal = Number(log.calories) || 0;
  const pro = Number(log.protein) || 0;
  const deficit = goals.tdee - cal;
  const deficitTarget = goals.tdee - goals.calories;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Date nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => {
            const d = new Date(date);
            d.setDate(d.getDate() - 1);
            setDate(d.toISOString().split("T")[0]);
          }}
          style={{
            background: "white",
            border: "1.5px solid #ebebeb",
            borderRadius: 9,
            width: 32,
            height: 32,
            cursor: "pointer",
            fontSize: 16,
            color: "#555",
          }}
        >
          ‹
        </button>
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontWeight: 700,
            fontSize: 15,
            color: "#111",
          }}
        >
          {date === todayKey ? "Today" : formatShort(date)}
        </div>
        <button
          onClick={() => {
            const d = new Date(date);
            d.setDate(d.getDate() + 1);
            setDate(d.toISOString().split("T")[0]);
          }}
          disabled={date >= todayKey}
          style={{
            background: "white",
            border: "1.5px solid #ebebeb",
            borderRadius: 9,
            width: 32,
            height: 32,
            cursor: date < todayKey ? "pointer" : "default",
            fontSize: 16,
            color: date < todayKey ? "#555" : "#ccc",
          }}
        >
          ›
        </button>
      </div>

      {/* Rings row */}
      <div style={{ display: "flex", gap: 10 }}>
        <Card
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            padding: "14px 8px",
          }}
        >
          <div style={{ position: "relative", width: 60, height: 60 }}>
            <Ring value={cal} max={goals.calories} color="#e11d48" />
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 800,
                color: "#e11d48",
              }}
            >
              {Math.round((cal / goals.calories) * 100)}%
            </div>
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#b0ada8",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Calories
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>
            {cal}
            <span style={{ color: "#ccc", fontWeight: 400 }}>
              /{goals.calories}
            </span>
          </div>
        </Card>

        <Card
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            padding: "14px 8px",
          }}
        >
          <div style={{ position: "relative", width: 60, height: 60 }}>
            <Ring value={pro} max={goals.protein} color="#16a34a" />
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 800,
                color: "#16a34a",
              }}
            >
              {Math.round((pro / goals.protein) * 100)}%
            </div>
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#b0ada8",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Protein
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>
            {pro}g
            <span style={{ color: "#ccc", fontWeight: 400 }}>
              /{goals.protein}g
            </span>
          </div>
        </Card>

        <Card
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            padding: "14px 8px",
          }}
        >
          <div style={{ position: "relative", width: 60, height: 60 }}>
            <Ring
              value={Math.max(deficit, 0)}
              max={Math.max(deficitTarget, 1)}
              color={
                deficit >= deficitTarget
                  ? "#0891b2"
                  : deficit > 0
                  ? "#f59e0b"
                  : "#e11d48"
              }
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 800,
                color: "#0891b2",
              }}
            >
              {deficit > 0 ? `+${deficit}` : deficit}
            </div>
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#b0ada8",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Deficit
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color:
                deficit >= deficitTarget
                  ? "#0891b2"
                  : deficit > 0
                  ? "#f59e0b"
                  : "#e11d48",
            }}
          >
            {deficit >= deficitTarget
              ? "On track ✓"
              : deficit > 0
              ? "Partial"
              : "Surplus"}
          </div>
        </Card>
      </div>

      {/* Remaining calories info */}
      {cal > 0 && (
        <div
          style={{
            background: "#fafaf8",
            borderRadius: 10,
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 12, color: "#888" }}>Remaining today</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: goals.calories - cal >= 0 ? "#16a34a" : "#e11d48",
            }}
          >
            {goals.calories - cal >= 0
              ? `${goals.calories - cal} kcal left`
              : `${cal - goals.calories} kcal over`}
          </span>
        </div>
      )}

      <NumInput
        label="Calories Eaten"
        value={log.calories || ""}
        onChange={(v) => setLog("calories", v)}
        unit="kcal"
      />
      <NumInput
        label="Protein"
        value={log.protein || ""}
        onChange={(v) => setLog("protein", v)}
        unit="g"
      />

      {/* Training */}
      <div>
        <SectionLabel>Training Session</SectionLabel>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {TRAIN_TYPES.map((t) => (
            <Chip
              key={t.id}
              label={t.label}
              emoji={t.emoji}
              color={t.color}
              active={log.training === t.id}
              onClick={() =>
                setLog("training", log.training === t.id ? null : t.id)
              }
            />
          ))}
        </div>
      </div>

      {/* Steps */}
      <Toggle
        label="👟 Hit 10,000 steps today"
        checked={!!log.steps10k}
        onChange={(v) => setLog("steps10k", v)}
        color="#16a34a"
      />

      {/* Notes */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <SectionLabel>Notes</SectionLabel>
        <textarea
          value={log.notes || ""}
          onChange={(e) => setLog("notes", e.target.value)}
          placeholder="How did today go?"
          style={{
            border: "1.5px solid #ebebeb",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 14,
            fontFamily: "inherit",
            resize: "vertical",
            minHeight: 70,
            outline: "none",
            color: "#333",
            background: "white",
          }}
        />
      </div>
    </div>
  );
}

// ── WEEKLY VIEW ──────────────────────────────────────────────────
function WeeklyView({ data, setData }) {
  const todayWeekKey = getWeekKey(getTodayKey());
  const [weekKey, setWeekKey] = useState(todayWeekKey);
  const wlog = data.weeklyLogs[weekKey] || {};
  const { goals } = data;

  const allWeekKeys = [
    ...new Set([...Object.keys(data.dailyLogs).map(getWeekKey), todayWeekKey]),
  ]
    .sort()
    .reverse();

  function setWlog(field, val) {
    setData((prev) => ({
      ...prev,
      weeklyLogs: {
        ...prev.weeklyLogs,
        [weekKey]: { ...prev.weeklyLogs[weekKey], [field]: val },
      },
    }));
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekKey + "T12:00:00");
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });
  const dayLogs = weekDays.map((d) => data.dailyLogs[d]).filter(Boolean);
  const avgCals = dayLogs.length
    ? Math.round(
        dayLogs.reduce((a, b) => a + (Number(b.calories) || 0), 0) /
          dayLogs.length
      )
    : null;
  const avgPro = dayLogs.length
    ? Math.round(
        dayLogs.reduce((a, b) => a + (Number(b.protein) || 0), 0) /
          dayLogs.length
      )
    : null;
  const totalDeficit = dayLogs.reduce(
    (a, b) => a + (goals.tdee - (Number(b.calories) || 0)),
    0
  );
  const stepDays = dayLogs.filter((d) => d.steps10k).length;

  const trainCounts = TRAIN_TYPES.filter((t) => t.id !== "rest").map((t) => ({
    ...t,
    count: weekDays.filter((d) => (data.dailyLogs[d] || {}).training === t.id)
      .length,
  }));

  const w = Number(wlog.weight);
  const currentBMI = w ? calcBMI(w, USER.height) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Week nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => {
            const i = allWeekKeys.indexOf(weekKey);
            if (i < allWeekKeys.length - 1) setWeekKey(allWeekKeys[i + 1]);
          }}
          style={{
            background: "white",
            border: "1.5px solid #ebebeb",
            borderRadius: 9,
            width: 32,
            height: 32,
            cursor: "pointer",
            fontSize: 16,
            color: "#555",
          }}
        >
          ‹
        </button>
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontWeight: 700,
            fontSize: 14,
            color: "#111",
          }}
        >
          {weekKey === todayWeekKey ? "This Week" : formatWeekRange(weekKey)}
        </div>
        <button
          onClick={() => {
            const i = allWeekKeys.indexOf(weekKey);
            if (i > 0) setWeekKey(allWeekKeys[i - 1]);
          }}
          disabled={weekKey === todayWeekKey}
          style={{
            background: "white",
            border: "1.5px solid #ebebeb",
            borderRadius: 9,
            width: 32,
            height: 32,
            cursor: weekKey !== todayWeekKey ? "pointer" : "default",
            fontSize: 16,
            color: weekKey !== todayWeekKey ? "#555" : "#ccc",
          }}
        >
          ›
        </button>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Card>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#b0ada8",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 5,
            }}
          >
            Avg Calories
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#e11d48" }}>
            {avgCals ?? "—"}
          </div>
          <div style={{ fontSize: 11, color: "#ccc" }}>
            target {goals.calories} kcal
          </div>
        </Card>
        <Card>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#b0ada8",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 5,
            }}
          >
            Weekly Deficit
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: totalDeficit > 0 ? "#0891b2" : "#e11d48",
            }}
          >
            {totalDeficit > 0 ? "+" : ""}
            {totalDeficit}
          </div>
          <div style={{ fontSize: 11, color: "#ccc" }}>kcal total</div>
        </Card>
        <Card>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#b0ada8",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 5,
            }}
          >
            Avg Protein
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>
            {avgPro ? `${avgPro}g` : "—"}
          </div>
          <div style={{ fontSize: 11, color: "#ccc" }}>
            target {goals.protein}g
          </div>
        </Card>
        <Card>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#b0ada8",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 5,
            }}
          >
            10k Steps
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>
            {stepDays}
            <span style={{ fontSize: 14, color: "#ccc", fontWeight: 500 }}>
              /7
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#ccc" }}>days hit</div>
        </Card>
      </div>

      {/* Training split */}
      <div>
        <SectionLabel>Training Split This Week</SectionLabel>
        <div style={{ display: "flex", gap: 7 }}>
          {trainCounts.map((t) => (
            <div
              key={t.id}
              style={{
                flex: 1,
                background: "white",
                border: `1.5px solid ${t.count > 0 ? t.color : "#ebebeb"}`,
                borderRadius: 12,
                padding: "10px 6px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 18 }}>{t.emoji}</div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: t.count > 0 ? t.color : "#ccc",
                }}
              >
                {t.label}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: t.count > 0 ? "#111" : "#ddd",
                }}
              >
                {t.count}×
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weight */}
      <NumInput
        label="Weekly Weight Check-in"
        value={wlog.weight || ""}
        onChange={(v) => setWlog("weight", v)}
        unit="kg"
      />
      {currentBMI && (
        <div
          style={{
            background: "#f8f8f6",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            color: "#666",
          }}
        >
          BMI: <strong style={{ color: "#111" }}>{currentBMI}</strong> · Height:{" "}
          {USER.height}cm
        </div>
      )}

      {/* Day breakdown */}
      <div>
        <SectionLabel>Day Breakdown</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {weekDays.map((d) => {
            const dl = data.dailyLogs[d] || {};
            const tr = TRAIN_TYPES.find((t) => t.id === dl.training);
            const isToday = d === getTodayKey();
            return (
              <div
                key={d}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "white",
                  border: `1.5px solid ${isToday ? "#111" : "#f0f0ee"}`,
                  borderRadius: 10,
                  padding: "9px 13px",
                }}
              >
                <div
                  style={{
                    width: 32,
                    fontSize: 12,
                    fontWeight: 700,
                    color: isToday ? "#111" : "#9ca3af",
                  }}
                >
                  {new Date(d + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                  })}
                </div>
                <div style={{ flex: 1, fontSize: 12, color: "#555" }}>
                  {dl.calories ? (
                    <>
                      {dl.calories} kcal · {dl.protein || 0}g pro
                    </>
                  ) : (
                    <span style={{ color: "#ddd" }}>No log</span>
                  )}
                </div>
                {dl.steps10k && <span style={{ fontSize: 12 }}>👟</span>}
                {tr && <span style={{ fontSize: 14 }}>{tr.emoji}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <SectionLabel>Weekly Reflection</SectionLabel>
        <textarea
          value={wlog.notes || ""}
          onChange={(e) => setWlog("notes", e.target.value)}
          placeholder="Wins, struggles, adjustments..."
          style={{
            border: "1.5px solid #ebebeb",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 14,
            fontFamily: "inherit",
            resize: "vertical",
            minHeight: 75,
            outline: "none",
            color: "#333",
            background: "white",
          }}
        />
      </div>
    </div>
  );
}

// ── TRENDS VIEW ──────────────────────────────────────────────────
function TrendsView({ data }) {
  const { goals } = data;

  const allDays = Object.entries(data.dailyLogs)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30);

  const calData = allDays.map(([d, log]) => ({
    date: formatShort(d),
    calories: Number(log.calories) || 0,
    deficit: goals.tdee - (Number(log.calories) || 0),
    target: goals.calories,
  }));

  const weightData = Object.entries(data.weeklyLogs)
    .filter(([, v]) => v.weight)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({ week: formatShort(k), weight: Number(v.weight) }));

  const stepsData = allDays.map(([d, log]) => ({
    date: formatShort(d),
    hit: log.steps10k ? 1 : 0,
    d,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Calorie intake bar chart */}
      <div>
        <SectionLabel>Calorie Intake — Last 30 Days</SectionLabel>
        {calData.length < 2 ? (
          <Card>
            <div
              style={{
                color: "#ccc",
                fontSize: 13,
                textAlign: "center",
                padding: "20px 0",
              }}
            >
              Log at least 2 days to see the chart
            </div>
          </Card>
        ) : (
          <Card style={{ padding: "16px 6px 8px" }}>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={calData} barSize={calData.length > 15 ? 6 : 10}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f5f5f3"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "#c0bdb8" }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.floor(calData.length / 5)}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#c0bdb8" }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip content={<CustomTooltip suffix=" kcal" />} />
                <ReferenceLine
                  y={goals.calories}
                  stroke="#e11d48"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                />
                <ReferenceLine
                  y={goals.tdee}
                  stroke="#0891b2"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                />
                <Bar
                  dataKey="calories"
                  name="Calories"
                  fill="#e11d48"
                  radius={[3, 3, 0, 0]}
                  opacity={0.8}
                />
              </BarChart>
            </ResponsiveContainer>
            <div
              style={{
                display: "flex",
                gap: 16,
                justifyContent: "center",
                marginTop: 4,
              }}
            >
              <div style={{ fontSize: 10, color: "#e11d48", fontWeight: 700 }}>
                — Target {goals.calories} kcal
              </div>
              <div style={{ fontSize: 10, color: "#0891b2", fontWeight: 700 }}>
                — TDEE {goals.tdee} kcal
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Deficit line chart */}
      <div>
        <SectionLabel>Daily Deficit Trend</SectionLabel>
        {calData.length < 2 ? (
          <Card>
            <div
              style={{
                color: "#ccc",
                fontSize: 13,
                textAlign: "center",
                padding: "20px 0",
              }}
            >
              No data yet
            </div>
          </Card>
        ) : (
          <Card style={{ padding: "16px 6px 8px" }}>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={calData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f5f5f3"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: "#c0bdb8" }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.floor(calData.length / 5)}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#c0bdb8" }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip content={<CustomTooltip suffix=" kcal" />} />
                <ReferenceLine y={0} stroke="#e5e5e3" strokeWidth={1} />
                <ReferenceLine
                  y={goals.tdee - goals.calories}
                  stroke="#0891b2"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{
                    value: "Goal",
                    position: "insideTopRight",
                    fontSize: 9,
                    fill: "#0891b2",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="deficit"
                  name="Deficit"
                  stroke="#0891b2"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Weight line chart */}
      <div>
        <SectionLabel>Weight Progress (kg)</SectionLabel>
        {weightData.length < 2 ? (
          <Card>
            <div
              style={{
                color: "#ccc",
                fontSize: 13,
                textAlign: "center",
                padding: "20px 0",
              }}
            >
              Log weight for 2+ weeks to see the chart
            </div>
          </Card>
        ) : (
          <Card style={{ padding: "16px 6px 8px" }}>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={weightData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f5f5f3"
                  vertical={false}
                />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 9, fill: "#c0bdb8" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "#c0bdb8" }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<CustomTooltip suffix=" kg" />} />
                <ReferenceLine
                  y={USER.startWeight}
                  stroke="#f59e0b"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{
                    value: "Start",
                    position: "insideTopRight",
                    fontSize: 9,
                    fill: "#f59e0b",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  name="Weight"
                  stroke="#7c3aed"
                  strokeWidth={2.5}
                  dot={{
                    fill: "#7c3aed",
                    r: 4,
                    strokeWidth: 2,
                    stroke: "white",
                  }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
            {weightData.length >= 2 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 20,
                  marginTop: 8,
                }}
              >
                <div style={{ fontSize: 11, color: "#777" }}>
                  Start: <strong>{weightData[0].weight}kg</strong>
                </div>
                <div style={{ fontSize: 11, color: "#777" }}>
                  Now:{" "}
                  <strong>{weightData[weightData.length - 1].weight}kg</strong>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color:
                      weightData[weightData.length - 1].weight <
                      weightData[0].weight
                        ? "#16a34a"
                        : "#e11d48",
                  }}
                >
                  {(
                    weightData[weightData.length - 1].weight -
                    weightData[0].weight
                  ).toFixed(1)}
                  kg
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Steps heatmap */}
      <div>
        <SectionLabel>10k Steps — Last 30 Days</SectionLabel>
        <Card>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {stepsData.length === 0 ? (
              <div
                style={{
                  color: "#ccc",
                  fontSize: 13,
                  width: "100%",
                  textAlign: "center",
                  padding: "10px 0",
                }}
              >
                No data yet
              </div>
            ) : (
              stepsData.map((d, i) => (
                <div
                  key={i}
                  title={d.date}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 7,
                    background: d.hit ? "#dcfce7" : "#f5f5f3",
                    border: `1.5px solid ${d.hit ? "#86efac" : "#ebebeb"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                  }}
                >
                  {d.hit ? "👟" : ""}
                </div>
              ))
            )}
          </div>
          {stepsData.length > 0 && (
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 10 }}>
              <strong style={{ color: "#16a34a" }}>
                {stepsData.filter((d) => d.hit).length}
              </strong>{" "}
              / {stepsData.length} days hit 10k steps
            </div>
          )}
        </Card>
      </div>

      {/* Training distribution */}
      <div>
        <SectionLabel>Training Distribution — All Time</SectionLabel>
        <Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TRAIN_TYPES.filter((t) => t.id !== "rest").map((t) => {
              const count = Object.values(data.dailyLogs).filter(
                (l) => l.training === t.id
              ).length;
              const total = Math.max(
                Object.values(data.dailyLogs).filter(
                  (l) => l.training && l.training !== "rest"
                ).length,
                1
              );
              return (
                <div
                  key={t.id}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <div style={{ fontSize: 15 }}>{t.emoji}</div>
                  <div
                    style={{
                      width: 52,
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#555",
                    }}
                  >
                    {t.label}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      background: "#f5f5f3",
                      borderRadius: 6,
                      height: 8,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${(count / total) * 100}%`,
                        height: "100%",
                        background: t.color,
                        borderRadius: 6,
                        transition: "width 0.7s ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      width: 28,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#555",
                      textAlign: "right",
                    }}
                  >
                    {count}×
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── SETTINGS VIEW ────────────────────────────────────────────────
function SettingsView({ data, setData }) {
  const { goals } = data;
  function setGoal(field, val) {
    setData((prev) => ({
      ...prev,
      goals: { ...prev.goals, [field]: Number(val) },
    }));
  }
  const deficitPerDay = goals.tdee - goals.calories;
  const kgPerWeek = ((deficitPerDay * 7) / 7700).toFixed(2);
  const weeksToGoal =
    goals.targetWeight && goals.targetWeight < USER.startWeight
      ? Math.ceil(
          ((USER.startWeight - goals.targetWeight) * 7700) / (deficitPerDay * 7)
        )
      : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ background: "#fafaf8", border: "none" }}>
        <div style={{ fontSize: 13, color: "#666", lineHeight: 1.8 }}>
          <div>
            📏 Height:{" "}
            <strong style={{ color: "#111" }}>{USER.height} cm</strong>
          </div>
          <div>
            ⚖️ Start weight:{" "}
            <strong style={{ color: "#111" }}>{USER.startWeight} kg</strong>
          </div>
          <div>
            🔥 TDEE:{" "}
            <strong style={{ color: "#111" }}>{goals.tdee} kcal</strong>
          </div>
        </div>
      </Card>

      <NumInput
        label="Daily Calorie Target"
        value={goals.calories}
        onChange={(v) => setGoal("calories", v)}
        unit="kcal"
      />
      <NumInput
        label="TDEE (maintenance calories)"
        value={goals.tdee}
        onChange={(v) => setGoal("tdee", v)}
        unit="kcal"
      />

      {deficitPerDay > 0 && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1.5px solid #bbf7d0",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 12,
            color: "#16a34a",
            fontWeight: 600,
            lineHeight: 1.7,
          }}
        >
          <div>Deficit: {deficitPerDay} kcal/day</div>
          <div>Est. loss: ~{kgPerWeek} kg/week</div>
        </div>
      )}

      <NumInput
        label="Daily Protein Goal"
        value={goals.protein}
        onChange={(v) => setGoal("protein", v)}
        unit="g"
      />
      <NumInput
        label="Target Weight"
        value={goals.targetWeight || ""}
        onChange={(v) => setGoal("targetWeight", v)}
        unit="kg"
      />

      {weeksToGoal && (
        <div
          style={{
            background: "#eff6ff",
            border: "1.5px solid #bfdbfe",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 12,
            color: "#2563eb",
            fontWeight: 600,
            lineHeight: 1.7,
          }}
        >
          <div>
            Still to lose: {(USER.startWeight - goals.targetWeight).toFixed(1)}{" "}
            kg
          </div>
          <div>Est. timeline: ~{weeksToGoal} weeks at current deficit</div>
        </div>
      )}
    </div>
  );
}

// ── ROOT ─────────────────────────────────────────────────────────
export default function CutTracker() {
  const [tab, setTab] = useState("daily");
  const [data, setData] = useState(defaultData);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORAGE_KEY);
        if (r?.value) setData(JSON.parse(r.value));
      } catch (_) {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await window.storage.set(STORAGE_KEY, JSON.stringify(data));
      } catch (_) {}
    })();
  }, [data, loaded]);

  const tabs = [
    { id: "daily", label: "Daily", icon: "📋" },
    { id: "weekly", label: "Weekly", icon: "📅" },
    { id: "trends", label: "Trends", icon: "📈" },
    { id: "settings", label: "Goals", icon: "⚙️" },
  ];

  return (
    <div
      style={{
        fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
        background: "#f7f7f5",
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 430 }}>
        {/* Header */}
        <div style={{ padding: "28px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: "#111",
                letterSpacing: "-0.03em",
              }}
            >
              Cut Tracker
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#e11d48",
                letterSpacing: "0.05em",
                background: "#fee2e2",
                padding: "2px 8px",
                borderRadius: 6,
              }}
            >
              -550 kcal/day
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#b0ada8", marginTop: 3 }}>
            64 kg · 168 cm · {USER.calorieTarget} kcal target
          </div>
        </div>

        {/* Tab bar */}
        <div
          style={{
            padding: "14px 20px 0",
            position: "sticky",
            top: 0,
            background: "#f7f7f5",
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              background: "white",
              border: "1.5px solid #ebebeb",
              borderRadius: 12,
              padding: 3,
              gap: 2,
            }}
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1,
                  padding: "7px 4px",
                  borderRadius: 9,
                  background: tab === t.id ? "#111" : "transparent",
                  color: tab === t.id ? "white" : "#9ca3af",
                  border: "none",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  fontSize: 10,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "18px 20px 60px" }}>
          {!loaded ? (
            <div
              style={{
                textAlign: "center",
                color: "#ddd",
                padding: 60,
                fontSize: 14,
              }}
            >
              Loading…
            </div>
          ) : tab === "daily" ? (
            <DailyView data={data} setData={setData} />
          ) : tab === "weekly" ? (
            <WeeklyView data={data} setData={setData} />
          ) : tab === "trends" ? (
            <TrendsView data={data} />
          ) : (
            <SettingsView data={data} setData={setData} />
          )}
        </div>
      </div>
    </div>
  );
}
