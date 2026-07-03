import type { SetProfile, Sex, UsersDoc } from "./onboardingTypes";

export default function MetricsStep({
  profile,
  setProfile,
}: {
  profile: UsersDoc;
  setProfile: SetProfile;
}) {
  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="row g-3">
        <div className="col-12">
          <label className="form-label ia-label">Sex</label>

          <div className="row g-2">
            {[
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "other", label: "Other / prefer not to say" },
            ].map((opt) => {
              const selected = profile.sex === opt.value;

              return (
                <div key={opt.value} className="col-12 col-md-4">
                  <button
                    type="button"
                    className={selected ? "ia-btn ia-btn-primary w-100" : "ia-btn ia-btn-outline w-100"}
                    onClick={() =>
                      setProfile((prev) => ({
                        ...prev,
                        sex: opt.value as Sex,
                      }))
                    }
                  >
                    {opt.label}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="col-12 col-md-4">
          <label className="form-label ia-label">Date of birth</label>
          <input
            type="date"
            className="form-control ia-form-input"
            value={profile.DOB || ""}
            onChange={(event) =>
              setProfile((prev) => ({
                ...prev,
                DOB: event.target.value || null,
              }))
            }
          />
        </div>

        <div className="col-12 col-md-4">
          <label className="form-label ia-label">Height (cm)</label>
          <input
            type="number"
            min="100"
            max="250"
            step="1"
            className="form-control ia-form-input"
            value={profile.height_cm ?? ""}
            onChange={(event) =>
              setProfile((prev) => ({
                ...prev,
                height_cm: event.target.value ? Number(event.target.value) : null,
              }))
            }
          />
        </div>

        <div className="col-12 col-md-4">
          <label className="form-label ia-label">Weight (kg)</label>
          <input
            type="number"
            min="25"
            max="300"
            step="0.1"
            className="form-control ia-form-input"
            value={profile.weight_kg ?? ""}
            onChange={(event) =>
              setProfile((prev) => ({
                ...prev,
                weight_kg: event.target.value ? Number(event.target.value) : null,
              }))
            }
          />
        </div>

        <div className="col-12 col-md-4">
          <label className="form-label ia-label">Body fat % (optional)</label>
          <input
            type="number"
            min="1"
            max="70"
            step="0.1"
            className="form-control ia-form-input"
            value={profile.bodyfat_pct ?? ""}
            onChange={(event) =>
              setProfile((prev) => ({
                ...prev,
                bodyfat_pct: event.target.value ? Number(event.target.value) : null,
              }))
            }
          />
        </div>
      </div>
    </section>
  );
}
