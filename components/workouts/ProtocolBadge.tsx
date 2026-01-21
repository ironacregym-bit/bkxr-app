
// components/workouts/ProtocolBadge.tsx
"use client";

export type KBStyle = "EMOM" | "AMRAP" | "LADDER";

const INFO: Record<KBStyle, { title: string; bullets: string[] }> = {
  EMOM: {
    title: "EMOM — Every Minute On the Minute",
    bullets: [
      "At the start of each minute, do the prescribed work.",
      "Rest in the remaining time of that minute.",
      "Repeat for the whole 3‑minute round.",
    ],
  },
  AMRAP: {
    title: "AMRAP — As Many Rounds/Reps As Possible",
    bullets: [
      "Work continuously for 3 minutes.",
      "Cycle the listed movements in order.",
      "Keep form tidy; pace so you can maintain quality.",
    ],
  },
  LADDER: {
    title: "LADDER — Ascending Reps",
    bullets: [
      "Alternate movements while increasing reps (e.g., 2 → 4 → 6…).",
      "Reset to the lowest rep after a high rung and keep going.",
      "Smooth rhythm beats rushing.",
    ],
  },
};

export default function ProtocolBadge({
  style,
  summaryLabel,
}: {
  style?: KBStyle;
  summaryLabel?: string; // defaults to style text
}) {
  if (!style) return null;

  return (
    <details style={{ marginLeft: 8 }}>
      <summary
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "6px 10px",
          borderRadius: 999,
          fontSize: 12,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.18)",
          cursor: "pointer",
          listStyle: "none",
        }}
      >
        {summaryLabel || style}
      </summary>

      <div
        className="mt-2"
        style={{
          padding: "8px 10px",
          borderLeft: "2px solid rgba(255,255,255,0.18)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{INFO[style].title}</div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {INFO[style].bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
