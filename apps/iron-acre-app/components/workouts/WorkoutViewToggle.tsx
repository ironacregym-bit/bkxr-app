
// components/workouts/WorkoutViewToggle.tsx
"use client";

type ViewMode = "list" | "follow";

/** Pill toggle for List | Follow‑along (state is owned by the page) */
export default function WorkoutViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const active: React.CSSProperties = {
    color: "#0b0b0b",
    background: "linear-gradient(135deg,#FF8A2A,#ff7f32)",
    boxShadow: "0 0 14px #FF8A2A66",
    border: "none",
  };
  const base: React.CSSProperties = {
    borderRadius: 24,
    padding: "8px 14px",
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "#e9eef6",
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div className="d-flex" style={{ gap: 8 }}>
      <button
        type="button"
        aria-pressed={value === "list"}
        style={{ ...base, ...(value === "list" ? active : {}) }}
        onClick={() => onChange("list")}
      >
        List
      </button>
      <button
        type="button"
        aria-pressed={value === "follow"}
        style={{ ...base, ...(value === "follow" ? active : {}) }}
        onClick={() => onChange("follow")}
      >
        Follow‑along
      </button>
    </div>
  );
}
