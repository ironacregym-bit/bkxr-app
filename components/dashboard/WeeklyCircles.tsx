
// components/Dashboard/WeeklyCircles.tsx
"use client";

type Props = {
  /** Weekly progress percentage (0–100). */
  weeklyProgressPercent: number;
  /** Weekly workouts completed (0–3). Count-only in subtext; ring shows % of 3 internally. */
  weeklyWorkoutsCompleted: number;
  /** Day streak (consecutive days fully filled). */
  dayStreak: number;
};

export default function WeeklyCircles({
  weeklyProgressPercent,
  weeklyWorkoutsCompleted,
  dayStreak,
}: Props) {
  // Workouts ring is % of 3, while we display the count-only in the subtext
  const workoutsPct = Math.max(0, Math.min(100, Math.round((weeklyWorkoutsCompleted / 3) * 100)));
  const progressPct = Math.max(0, Math.min(100, Math.round(weeklyProgressPercent)));

  // Compact footprint (half of original)
  const size = 64;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      // Grid of three cards with slight separators
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 10,
      }}
    >
      {/* Card 1: Weekly Progress */}
      <div className="futuristic-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
        <Circle
          size={size}
          stroke={stroke}
          radius={r}
          circumference={c}
          percent={progressPct}
          label="Weekly Progress"
          sub={`${progressPct}%`}
        />
      </div>

      {/* Card 2: Workouts (count only) */}
      <div className="futuristic-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
        <Circle
          size={size}
          stroke={stroke}
          radius={r}
          circumference={c}
          percent={workoutsPct}
          label="Workouts"
          sub={`${weeklyWorkoutsCompleted}`} // count only; no “/3”
        />
      </div>

      {/* Card 3: Day Streak */}
      <div className="futuristic-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
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

  // Scoped gradient ID to avoid collisions
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
        {/* Center text (scaled for compact ring) */}
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
