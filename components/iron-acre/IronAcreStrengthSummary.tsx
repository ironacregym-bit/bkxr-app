// components/iron-acre/IronAcreStrengthSummary.tsx
import Link from "next/link";
import { IA, neonCardStyle } from "./theme";
import { BIG_LIFTS, resolveProfileLift, type StrengthProfile } from "../../lib/iron-acre/strengthLifts";

export default function IronAcreStrengthSummary({ profile }: { profile?: StrengthProfile }) {
  return (
    <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="m-0">Strength</h6>

        <span
          className="badge"
          style={{
            background: `rgba(24,255,154,0.12)`,
            color: IA.neon,
            border: `1px solid ${IA.borderSoft}`,
          }}
        >
          e1RM + 1RM
        </span>
      </div>

      <div className="d-flex flex-column" style={{ gap: 10 }}>
        {BIG_LIFTS.map((lift, idx) => {
          const { true1rm, trainingMax } = resolveProfileLift(profile, lift);

          // Home summary: show true 1RM if available, else training max, else —
          const value = true1rm ?? trainingMax ?? null;
          const source = true1rm != null ? "True 1RM" : trainingMax != null ? "Training max" : "Not set";

          return (
            <Link
              key={lift.key}
              href={`/iron-acre/strength/${lift.key}`}
              aria-label={`View ${lift.label} strength details`}
              className="d-flex justify-content-between align-items-center"
              style={{
                paddingTop: 10,
                paddingBottom: 10,
                borderTop: idx === 0 ? "none" : "1px solid rgba(255,255,255,0.08)",
                textDecoration: "none",
                color: "#fff",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="fw-semibold">{lift.label}</div>
                <div className="text-dim small">{source}</div>
              </div>

              <div className="d-flex align-items-center gap-2">
                <div
                  style={{
                    color: value != null ? IA.neon : "#888",
                    fontWeight: 900,
                    fontSize: "1.1rem",
                    textShadow: value != null ? `0 0 10px ${IA.neon}40` : "none",
                    minWidth: 70,
                    textAlign: "right",
                    whiteSpace: "nowrap",
                  }}
                >
                  {value != null ? `${value}kg` : "—"}
                </div>

                <i className="fas fa-chevron-right text-dim" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-3">
        <Link href="/iron-acre/strength" className="text-dim small" style={{ textDecoration: "none" }}>
          View strength details <i className="fas fa-chevron-right" style={{ marginLeft: 6 }} />
        </Link>
      </div>
    </section>
  );
}
