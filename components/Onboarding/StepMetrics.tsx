
// components/Onboarding/StepMetrics.tsx
import type { UsersDoc } from "./types";

type Props = {
  profile: UsersDoc;
  setProfile: (updater: (p: UsersDoc) => UsersDoc) => void;
  markDirty: () => void;
};

// Normalise DOB into YYYY-MM-DD string for <input type="date">
// Accepts number (millis), Date, ISO string with/without time.
function toDateInputValue(val: unknown): string {
  if (!val) return "";
  try {
    if (typeof val === "number") {
      const d = new Date(val);
      if (isNaN(d.getTime())) return "";
      return d.toISOString().slice(0, 10);
    }
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return "";
      return val.toISOString().slice(0, 10);
    }
    if (typeof val === "string") {
      // If already YYYY-MM-DD, return as-is
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
      // Try to parse other ISO forms
      const d = new Date(val);
      if (isNaN(d.getTime())) return "";
      return d.toISOString().slice(0, 10);
    }
  } catch {
    // fall-through
  }
  return "";
}

export default function StepMetrics({ profile, setProfile, markDirty }: Props) {
  const dobValue = toDateInputValue(profile.DOB);

  return (
    <section
      className="futuristic-card p-4 mb-3 d-flex flex-column justify-content-center"
      style={{ minHeight: "65vh" }}
    >
      <h5 className="mb-2">Your Metrics</h5>

      <div className="row g-3">
        {/* Height */}
        <div className="col-12 col-md-6">
          <label className="form-label small text-dim" htmlFor="height_cm">
            Height (cm)
          </label>
          <input
            id="height_cm"
            type="number"
            inputMode="numeric"
            min={80}
            max={250}
            step="1"
            placeholder="e.g. 178"
            className="form-control"
            value={profile.height_cm ?? ""}
            onChange={(e) =>
              setProfile((prev) => {
                markDirty();
                const v = e.target.value.trim();
                return { ...prev, height_cm: v === "" ? null : Number(v) || null };
              })
            }
            aria-describedby="heightHelp"
          />
          <div id="heightHelp" className="form-text text-dim">
            Enter your height in centimetres.
          </div>
        </div>

        {/* Weight */}
        <div className="col-12 col-md-6">
          <label className="form-label small text-dim" htmlFor="weight_kg">
            Weight (kg)
          </label>
          <input
            id="weight_kg"
            type="number"
            inputMode="decimal"
            min={30}
            max={300}
            step="0.1"
            placeholder="e.g. 82.5"
            className="form-control"
            value={profile.weight_kg ?? ""}
            onChange={(e) =>
              setProfile((prev) => {
                markDirty();
                const raw = e.target.value.trim();
                // Allow decimals; empty -> null
                return { ...prev, weight_kg: raw === "" ? null : Number(raw) || null };
              })
            }
            aria-describedby="weightHelp"
          />
          <div id="weightHelp" className="form-text text-dim">
            You can use decimals (e.g. 82.5).
          </div>
        </div>

        {/* DOB */}
        <div className="col-12 col-md-6">
          <label className="form-label small text-dim" htmlFor="dob">
            Date Of Birth
          </label>
          <input
            id="dob"
            type="date"
            className="form-control"
            value={dobValue}
            onChange={(e) =>
              setProfile((prev) => {
                markDirty();
                // Store as YYYY-MM-DD (keeps it simple and consistent for your API)
                const v = e.target.value;
                return { ...prev, DOB: v || null };
              })
            }
            aria-describedby="dobHelp"
          />
          <div id="dobHelp" className="form-text text-dim">
            Use your real date for accurate targets.
          </div>
        </div>

        {/* Sex */}
        <div className="col-12 col-md-6">
          <label className="form-label small text-dim" htmlFor="sex">
            Gender
          </label>
          <select
            id="sex"
            className="form-select"
            value={profile.sex ?? ""}
            onChange={(e) =>
              setProfile((prev) => {
                markDirty();
                return { ...prev, sex: (e.target.value || null) as UsersDoc["sex"] };
              })
            }
            aria-describedby="sexHelp"
          >
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other / Prefer Not To Say</option>
          </select>
          <div id="sexHelp" className="form-text text-dim">
            This helps estimate your calorie targets.
          </div>
        </div>

        {/* Bodyfat */}
        <div className="col-12 col-md-6">
          <label className="form-label small text-dim" htmlFor="bodyfat_pct">
            Body Fat (%) <span className="text-dim">(If Known)</span>
          </label>
          <input
            id="bodyfat_pct"
            type="number"
            inputMode="decimal"
            min={2}
            max={70}
            step="0.1"
            placeholder="e.g. 18"
            className="form-control"
            value={profile.bodyfat_pct ?? ""}
            onChange={(e) =>
              setProfile((prev) => {
                markDirty();
                const raw = e.target.value.trim();
                return { ...prev, bodyfat_pct: raw === "" ? null : Number(raw) || null };
              })
            }
            aria-describedby="bfHelp"
          />
          <div id="bfHelp" className="form-text text-dim">
            Optional—helps refine your macros.
          </div>
        </div>
      </div>
    </section>
  );
}
