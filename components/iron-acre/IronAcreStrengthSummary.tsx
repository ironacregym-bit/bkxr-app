// components/iron-acre/IronAcreStrengthSummary.tsx
import Link from "next/link";
import { IA, neonCardStyle } from "./theme";

type StrengthProfile = {
  training_maxes?: Record<string, number>;
  true_1rms?: Record<string, number>;
};

type LiftDef = {
  key: string;
  label: string;
  exerciseNames: string[]; // exact names as stored in Firestore
};

const BIG_LIFTS: LiftDef[] = [
  {
    key: "deadlift",
    label: "Deadlift",
    exerciseNames: ["Deadlift", "Barbell Deadlift"],
  },
  {
    key: "back_squat",
    label: "Back Squat",
    exerciseNames: ["Back Squat", "Barbell Back Squat"],
  },
  {
    key: "bench_press",
    label: "Bench Press",
    exerciseNames: ["Barbell Bench Press", "Bench Press"],
  },
  {
    key: "overhead_press",
    label: "Overhead Press",
    exerciseNames: ["Overhead Press", "Barbell Overhead Press", "Strict Press"],
  },
];

function resolveLiftValue(
  profile: StrengthProfile | undefined,
  lift: LiftDef
): { value: number | null; source: "true" | "training" | null } {
  if (!profile) return { value: null, source: null };

  for (const name of lift.exerciseNames) {
    const trueVal = profile.true_1rms?.[name];
    if (typeof trueVal === "number") {
      return { value: trueVal, source: "true" };
    }
  }

  for (const name of lift.exerciseNames) {
    const tm = profile.training_maxes?.[name];
    if (typeof tm === "number") {
      return { value: tm, source: "training" };
    }
  }

  return { value: null, source: null };
}

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
          1RM
        </span>
      </div>

      <div className="d-flex flex-column" style={{ gap: 10 }}>
        {BIG_LIFTS.map((lift) => {
          const { value, source } = resolveLiftValue(profile, lift);

          return (
            <Link
              key={lift.key}
              href={`/iron-acre/strength/${lift.key}`}
              className="d-flex justify-content-between align-items-center"
              style={{
                paddingTop: 10,
                paddingBottom: 10,
                borderTop: "1px solid rgba(255,255,255,0.08)",
                textDecoration: "none",
                color: "#fff",
              }}
            >
              <div>
                <div className="fw-semibold">{lift.label}</div>
                <div className="text-dim small">
                  {source === "true"
                    ? "True 1RM"
                    : source === "training"
                    ? "Training max"
                    : "Not set"}
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                <div
                  style={{
                    color: value != null ? IA.neon : "#888",
                    fontWeight: 900,
                    fontSize: "1.1rem",
                    textShadow: value != null ? `0 0 10px ${IA.neon}40` : "none",
                    minWidth: 56,
                    textAlign: "right",
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
        <Link
          href="/iron-acre/strength"
          className="text-dim small"
          style={{ textDecoration: "none" }}
        >
          View strength details <i className="fas fa-chevron-right" style={{ marginLeft: 6 }} />
        </Link>
      </div>
    </section>
  );
}
