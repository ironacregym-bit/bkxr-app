// components/iron-acre/IronAcreStrengthSummary.tsx
"use client";

import Link from "next/link";
import { BIG_LIFTS, resolveProfileLift } from "../../lib/iron-acre/strengthLifts";

type StrengthProfile = {
  training_maxes?: Record<string, number>;
  true_1rms?: Record<string, number>;
  rounding_increment_kg?: number;
  updated_at?: any;
};

type LiftRow = {
  key: string;
  label: string;
  href: string;
  value: number | null;
  sourceLabel: string;
};

function sourceLabel(true1rm: number | null, trainingMax: number | null): string {
  if (true1rm != null) return "True 1RM";
  if (trainingMax != null) return "Training max";
  return "Not set";
}

function buildRows(profile?: StrengthProfile): LiftRow[] {
  return BIG_LIFTS.map((lift) => {
    const { true1rm, trainingMax } = resolveProfileLift(profile as any, lift);
    const value = true1rm ?? trainingMax ?? null;

    return {
      key: lift.key,
      label: lift.label,
      href: `/iron-acre/strength/${lift.key}`,
      value,
      sourceLabel: sourceLabel(true1rm ?? null, trainingMax ?? null),
    };
  });
}

function formatKg(value: number | null): string {
  return value == null ? "—" : `${value}kg`;
}

export default function IronAcreStrengthSummary({ profile }: { profile?: StrengthProfile }) {
  const rows = buildRows(profile);

  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="ia-kicker">
          <i className="fas fa-dumbbell" />
          STRENGTH
        </div>

        <span className="ia-badge ia-badge-neon">e1RM + 1RM</span>
      </div>

      <div className="text-dim small mb-2">
        Snapshot of your current big-lift numbers pulled from your saved strength profile.
      </div>

      <div className="d-flex flex-column">
        {rows.map((r, idx) => (
          <Link
            key={r.key}
            href={r.href}
            className="ia-link d-flex justify-content-between align-items-center"
            style={{
              paddingTop: 10,
              paddingBottom: 10,
              borderTop: idx === 0 ? "none" : "1px solid rgba(255,255,255,0.08)",
            }}
            aria-label={`Open ${r.label} strength details`}
          >
            <div style={{ minWidth: 0 }}>
              <div className="fw-semibold">{r.label}</div>
              <div className="text-dim small">{r.sourceLabel}</div>
            </div>

            <div className="d-flex align-items-center gap-2" style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}>
              <div
                style={{
                  fontWeight: 700,
                  color: "var(--ia-neon)",
                }}
              >
                {formatKg(r.value)}
              </div>

              <i className="fas fa-chevron-right text-dim" />
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-2">
        <Link href="/iron-acre/strength" className="text-dim small ia-link">
          View strength details <i className="fas fa-chevron-right" style={{ marginLeft: 6 }} />
        </Link>
      </div>
    </section>
  );
}
