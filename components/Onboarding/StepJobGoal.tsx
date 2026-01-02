
// components/Onboarding/StepJobGoal.tsx
import type { UsersDoc, JobType } from "./types";

type Props = {
  profile: UsersDoc;
  setProfile: (updater: (p: UsersDoc) => UsersDoc) => void;
  markDirty: () => void;
  canShowTargets: boolean;
  targets: { calorie_target?: number | null; protein_target?: number | null; carb_target?: number | null; fat_target?: number | null; };
};

const ACCENT = "#FF8A2A";

export default function StepJobGoal({ profile, setProfile, markDirty, canShowTargets, targets }: Props) {
  const jobTypeOptions = [
    { key: "desk" as JobType, label: "Desk / Office", af: 1.2 },
    { key: "mixed" as JobType, label: "Mixed", af: 1.375 },
    { key: "manual" as JobType, label: "Manual / Labour", af: 1.55 },
    { key: "athlete" as JobType, label: "Athlete", af: 1.9 },
  ];

  const goalOptions = [
    { key: "tone" as UsersDoc["goal_primary"], label: "Tone Up" },
    { key: "lose" as UsersDoc["goal_primary"], label: "Drop Fat" },
    { key: "gain" as UsersDoc["goal_primary"], label: "Put On Muscle" },
  ];

  return (
    <section className="futuristic-card p-4 mb-3 d-flex flex-column justify-content-center" style={{ minHeight: "65vh" }}>
      <h5 className="mb-2">Job Type</h5>
      <div className="d-flex flex-wrap gap-2 mb-3">
        {jobTypeOptions.map((opt) => {
          const active = profile.job_type === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              aria-pressed={active}
              className="btn-bxkr-outline"
              onClick={() =>
                setProfile((prev) => {
                  markDirty();
                  return { ...prev, job_type: opt.key, activity_factor: opt.af };
                })
              }
              style={{
                background: active ? "rgba(255,138,42,0.12)" : undefined,
                borderColor: active ? ACCENT : undefined,
                color: active ? "#fff" : undefined,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <h5 className="mb-2">Main Goal</h5>
      <div className="d-flex flex-wrap gap-2">
        {goalOptions.map((opt) => {
          const active = profile.goal_primary === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              aria-pressed={active}
              className="btn-bxkr-outline"
              onClick={() =>
                setProfile((prev) => {
                  markDirty();
                  return { ...prev, goal_primary: opt.key };
                })
              }
              style={{
                background: active ? "rgba(255,138,42,0.12)" : undefined,
                borderColor: active ? ACCENT : undefined,
                color: active ? "#fff" : undefined,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {canShowTargets && (
        <div className="futuristic-card p-3 mt-3" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="fw-semibold mb-1">Targets (Per Day)</div>
          <div className="small">
            <div>Calories: <strong>{targets.calorie_target ?? "—"}</strong> kcal</div>
            <div>Protein: <strong>{targets.protein_target ?? "—"}</strong> g</div>
            <div>Carbs: <strong>{targets.carb_target ?? "—"}</strong> g</div>
            <div>Fat: <strong>{targets.fat_target ?? "—"}</strong> g</div>
          </div>
        </div>
      )}
    </section>
  );
}
