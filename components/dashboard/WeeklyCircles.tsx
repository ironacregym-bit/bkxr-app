
// components/Dashboard/WeeklyCircles.tsx
"use client";

type Props = {
  /** Weekly progress percentage (0–100). */
  weeklyProgressPercent: number;
  /** Weekly workouts completed (0–3). Will be displayed as % of 3. */
  weeklyWorkoutsCompleted: number;
  /** Day streak (consecutive days fully filled). */
  dayStreak: number;
};

export default function WeeklyCircles({
  weeklyProgressPercent,
  weeklyWorkoutsCompleted,
  dayStreak,
}: Props) {
  const workoutsPct = Math.max(0, Math.min(100, Math.round((weeklyWorkoutsCompleted / 3) * 100)));
  const progressPct = Math.max(0, Math.min(100, Math.round(weeklyProgressPercent)));
  const size = 100;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      className="bxkr-card p-3"
      style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, alignItems: "center" }}
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
        label="Workouts (of 3)"
        sub={`${weeklyWorkoutsCompleted}/3`}
      />
      <Circle
        size={size}
        stroke={stroke}
        radius={r}
        circumference={c}
        percent={Math.min(100, dayStreak)} // just to cap the ring visually
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

  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id="bxkrGrad" x1="0%" y1="0%" x2="100%" y2="0%">
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
          stroke="url(#bxkrGrad)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {/* Center text */}
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          style={{ fontWeight: 700, fontSize: 16 }}
        >
          {sub}
        </text>
      </svg>
      <div className="text-dim" style={{ marginTop: 6, fontSize: 13 }}>{label}</div>
    </div>
   );
}
