
// components/workouts/TechniqueChips.tsx
"use client";

export type BoxingAction = {
  kind: "punch" | "defence";
  code: string;
  count?: number;
  notes?: string;
};

const LABELS: Record<string, string> = {
  "1": "Jab",
  "2": "Cross",
  "3": "Lead Hook",
  "4": "Rear Hook",
  "5": "Lead Uppercut",
  "6": "Rear Uppercut",
  D: "Duck",
  jab: "Jab",
  cross: "Cross",
  lead_hook: "Lead Hook",
  rear_hook: "Rear Hook",
  lead_uppercut: "Lead Uppercut",
  rear_uppercut: "Rear Uppercut",
  duck: "Duck",
};

export default function TechniqueChips({
  actions,
  techVideoByCode,
  onActionClick, // (code: string) => void
}: {
  actions: BoxingAction[];
  techVideoByCode?: Record<string, string | undefined>;
  onActionClick?: (code: string) => void;
}) {
  const codes = Array.from(new Set(actions.map((a) => a.code))).filter(Boolean);
  if (!codes.length) return null;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
      {codes.map((code) => {
        const label = LABELS[code] || code;
        const href = techVideoByCode?.[code];

        return (
          <button
            key={code}
            className="btn btn-bxkr-outline btn-sm"
            style={{ borderRadius: 999 }}
            onClick={() => onActionClick?.(code)}
            title={href ? `${label} • tap to view` : label}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
