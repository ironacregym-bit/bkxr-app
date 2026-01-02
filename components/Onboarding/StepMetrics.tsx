
// components/Onboarding/StepMetrics.tsx
import type { UsersDoc } from "./types";

type Props = {
  profile: UsersDoc;
  setProfile: (updater: (p: UsersDoc) => UsersDoc) => void;
  markDirty: () => void;
};

export default function StepMetrics({ profile, setProfile, markDirty }: Props) {
  return (
    <section className="futuristic-card p-4 mb-3 d-flex flex-column justify-content-center" style={{ minHeight: "65vh" }}>
      <h5 className="mb-2">Your Metrics</h5>
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label small text-dim">Height (cm)</label>
          <input
            type="number"
            className="form-control"
            value={profile.height_cm ?? ""}
            onChange={(e) =>
              setProfile((prev) => {
                markDirty();
                return { ...prev, height_cm: Number(e.target.value) || null };
              })
            }
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small text-dim">Weight (kg)</label>
          <input
            type="number"
            className="form-control"
            value={profile.weight_kg ?? ""}
            onChange={(e) =>
              setProfile((prev) => {
                markDirty();
                return { ...prev, weight_kg: Number(e.target.value) || null };
              })
            }
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small text-dim">Date Of Birth</label>
          <input
            type="date"
            className="form-control"
            value={profile.DOB ?? ""}
            onChange={(e) =>
              setProfile((prev) => {
                markDirty();
                return { ...prev, DOB: e.target.value || null };
              })
            }
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small text-dim">Gender</label>
          <select
            className="form-select"
            value={profile.sex ?? ""}
            onChange={(e) =>
              setProfile((prev) => {
                markDirty();
                return { ...prev, sex: (e.target.value || null) as UsersDoc["sex"] };
              })
            }
          >
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other / Prefer Not To Say</option>
          </select>
        </div>
        <div className="col-12 col-md-6">
                   <label className="form-label small text-dim">
            Body Fat (%) <span className="text-dim">(If Known)</span>
          </label>
          <input
            type="number"
            className="form-control"
            value={profile.bodyfat_pct ?? ""}
            onChange={(e) =>
              setProfile((prev) => {
                markDirty();
                return { ...prev, bodyfat_pct: Number(e.target.value) || null };
              })
            }
          />
        </div>
      </div>
    </section>
  );
}
