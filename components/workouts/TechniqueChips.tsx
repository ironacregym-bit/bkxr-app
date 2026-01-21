
// components/workouts/TechniqueChips.tsx
"use client";

export type BoxingAction = {
  kind: "punch" | "defence";
  code: string;       // e.g. "1"…"6", "D" or text codes like "jab"
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
}: {
  actions: BoxingAction[];
  techVideoByCode?: Record<string, string | undefined>;
}) {
  const codes = Array.from(new Set(actions.map((a) => a.code))).filter(Boolean);
  if (!codes.length) return null;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
      {codes.map((code) => {
        const label = LABELS[code] || code;
        const href = techVideoByCode?.[code];

        return href ? (
          <a
            key={code}
            href={href}
            target="_blank"
            rel="noreferrer"
            title={`Technique: ${label}`}
            className="text-decoration-none"
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 12,
              background: "rgba(100,195,122,0.15)",
              border: "1px solid rgba(100,195,122,0.35)",
              color: "#64c37a",
              whiteSpace: "nowrap",
            }}
          >
            {label} • video
          </a>
        ) : (
          <span
            key={code}
            title={`Technique (add later): ${label}`}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 12,
              background: "rgba(255,255,255,0.06)",
              border: "1px dashed rgba(255,255,255,0.25)",
              color: "rgba(255,255,255,0.9)",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
