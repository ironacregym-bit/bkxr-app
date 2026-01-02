
// components/Dashboard/WeeklyCircles.tsx
"use client";

type Props = {
  /** Weekly progress percentage (0–100). */
  weeklyProgressPercent: number;
  /** Weekly workouts completed (0–3). Count only in label/sub; ring shows % of 3 internally. */
  weeklyWorkoutsCompleted: number;
  /** Day streak (consecutive days fully filled). */
  dayStreak: number;
};

export default function WeeklyCircles({
  weeklyProgressPercent,
  weeklyWorkoutsCompleted,
  dayStreak,
}: Props) {
  // Keep workouts ring as % of 3, but display "Workouts" + count only.
  const workoutsPct = Math.max(0, Math.min(100, Math.round((weeklyWorkoutsCompleted / 3) * 100)));
  const progressPct = Math.max(0, Math.min(100, Math.round(weeklyProgressPercent)));

  // ✨ Smaller overall footprint (about half the previous vertical size)
  const size = 64;            // was 100
  const stroke = 8;           // was 10
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      // No background here; let the parent wrap in a glass card if desired
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 8,
        alignItems: "center",
      }}
    >
      <Circle
        size={size}
        stroke={stroke}
        radius={r}
        circumference={c}
        percent={progressPct}
        label="Weekly Progress"
        sub={`${progressPct}%`}
      />
      <Circle
        size={size}
        stroke={stroke}
        radius={r}
        circumference={c}
        percent={workoutsPct}
        label="Workouts"
        sub={`${weeklyWorkoutsCompleted}`} // ✂️ removed “/3”
      />
      <Circle
        size={size}
        stroke={stroke}
        radius={r}
        circumference={c}
        percent={Math.min(100, dayStreak)} // visual cap only
        label="Day Streak"
        sub={`${dayStreak}d`}
      />
    </div>
  );
}

function Circle({
  size,
  stroke,
  radius,
  circumference,
  percent,
  label,
  sub,
}: {
  size: number;
  stroke: number;
  radius: number;
  circumference: number;
  percent: number;
  label: string;
  sub: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;

  // Use a scoped gradient ID to avoid collisions if multiple instances render
  const gradId = "bxkrWeeklyGrad";

  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff7f32" />
            <stop offset="100%" stopColor="#ff9a3a" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={stroke}
          fill="none"
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {/* Center text (scaled down for smaller rings) */}
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          style={{ fontWeight: 700, fontSize: 12 }}
        >
          {sub}
        </text>
      </svg>
      <div className="text-dim" style={{ marginTop: 4, fontSize: 12 }}>{label}</div>
    </div>
  );
}
