// OnboardingSteps.tsx
import type {
  GoalPrimary,
  GymOption,
  MacroTargets,
  ProgramOption,
  Sex,
  UsersDoc,
} from "./onboardingTypes";
import {
  ACTIVITY_OPTIONS,
  formatNumber,
  getGoalLabel,
  getUserTypeTitle,
} from "./onboardingUtils";

type SetProfile = (updater: (prev: UsersDoc) => UsersDoc) => void;

export function MetricsStep({
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
            onChange={(e) =>
              setProfile((prev) => ({
                ...prev,
                DOB: e.target.value || null,
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
            onChange={(e) =>
              setProfile((prev) => ({
                ...prev,
                height_cm: e.target.value ? Number(e.target.value) : null,
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
            onChange={(e) =>
              setProfile((prev) => ({
                ...prev,
                weight_kg: e.target.value ? Number(e.target.value) : null,
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
            onChange={(e) =>
              setProfile((prev) => ({
                ...prev,
                bodyfat_pct: e.target.value ? Number(e.target.value) : null,
              }))
            }
          />
        </div>
      </div>
    </section>
  );
}

export function GoalStep({
  profile,
  setProfile,
}: {
  profile: UsersDoc;
  setProfile: SetProfile;
}) {
  return (
    <>
      <section className="ia-tile ia-tile-pad mb-3">
        <div className="mb-3">
          <div className="ia-card-title-compact">What’s your main goal?</div>
          <div className="text-dim small mt-1">
            We’ll use this to set your calorie and macro targets.
          </div>
        </div>

        <div className="d-grid gap-2">
          {[
            {
              value: "lose",
              title: "Lose weight",
              subtitle: "Create a manageable calorie deficit while keeping protein high.",
            },
            {
              value: "tone",
              title: "Maintain / tone",
              subtitle: "Support body composition and recovery without pushing calories aggressively.",
            },
            {
              value: "gain",
              title: "Gain muscle",
              subtitle: "Support training performance and lean muscle gain with extra energy.",
            },
          ].map((opt) => {
            const selected = profile.goal_primary === opt.value;

            return (
              <button
                key={opt.value}
                type="button"
                className={selected ? "ia-onb-choice ia-onb-choice-selected" : "ia-onb-choice"}
                onClick={() =>
                  setProfile((prev) => ({
                    ...prev,
                    goal_primary: opt.value as GoalPrimary,
                  }))
                }
              >
                <span className="ia-onb-choice-title">{opt.title}</span>
                <span className="ia-onb-choice-subtitle">{opt.subtitle}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="ia-tile ia-tile-pad mb-3">
        <div className="mb-3">
          <div className="ia-card-title-compact">How active are you outside training?</div>
          <div className="text-dim small mt-1">
            This helps estimate daily energy needs more accurately.
          </div>
        </div>

        <div className="d-grid gap-2">
          {ACTIVITY_OPTIONS.map((opt) => {
            const selected = profile.job_type === opt.job_type;

            return (
              <button
                key={opt.job_type || opt.title}
                type="button"
                className={selected ? "ia-onb-choice ia-onb-choice-selected" : "ia-onb-choice"}
                onClick={() =>
                  setProfile((prev) => ({
                    ...prev,
                    job_type: opt.job_type,
                    activity_factor: opt.factor,
                  }))
                }
              >
                <span className="ia-onb-choice-title">{opt.title}</span>
                <span className="ia-onb-choice-subtitle">{opt.subtitle}</span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

export function ProgramStep({
  profile,
  programs,
  gyms,
  programsLoading,
  gymsLoading,
  setProfile,
}: {
  profile: UsersDoc;
  programs: ProgramOption[];
  gyms: GymOption[];
  programsLoading: boolean;
  gymsLoading: boolean;
  setProfile: SetProfile;
}) {
  return (
    <>
      <section className="ia-tile ia-tile-pad mb-3">
        <div className="mb-3">
          <div className="ia-card-title-compact">Choose your programme</div>
          <div className="text-dim small mt-1">
            Pick the plan you want Iron Acre to build your training around.
          </div>
        </div>

        {programsLoading ? (
          <div className="text-dim small">Loading programmes…</div>
        ) : programs.length ? (
          <div className="d-grid gap-2">
            {programs.map((program) => {
              const selected = profile.program_id === program.program_id || profile.program_id === program.id;

              return (
                <button
                  key={program.id}
                  type="button"
                  className={selected ? "ia-onb-choice ia-onb-choice-selected" : "ia-onb-choice"}
                  onClick={() =>
                    setProfile((prev) => ({
                      ...prev,
                      program_id: program.program_id || program.id,
                      program_name: program.title,
                      workout_type: program.program_id || program.id,
                    }))
                  }
                >
                  <span className="ia-onb-choice-title">{program.title}</span>
                  <span className="ia-onb-choice-subtitle">{program.subtitle}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-dim small">No programmes are available yet.</div>
        )}
      </section>

      <section className="ia-tile ia-tile-pad mb-3">
        <div className="mb-3">
          <div className="ia-card-title-compact">How will you use Iron Acre?</div>
          <div className="text-dim small mt-1">
            Choose whether you want gym updates and class access, or online training only.
          </div>
        </div>

        <div className="d-grid gap-2">
          {gymsLoading ? <div className="text-dim small">Loading gyms…</div> : null}

          {gyms.map((gym) => {
            const selected = profile.user_type === "gym" && profile.gym_id === gym.id;

            return (
              <button
                key={gym.id}
                type="button"
                className={selected ? "ia-onb-choice ia-onb-choice-selected" : "ia-onb-choice"}
                onClick={() =>
                  setProfile((prev) => ({
                    ...prev,
                    user_type: "gym",
                    membership_status: "gym_member",
                    gym_id: gym.id,
                    gym_name: gym.title,
                  }))
                }
              >
                <span className="ia-onb-choice-title">{gym.title}</span>
                <span className="ia-onb-choice-subtitle">{gym.subtitle}</span>
              </button>
            );
          })}

          <button
            type="button"
            className={profile.user_type === "online" ? "ia-onb-choice ia-onb-choice-selected" : "ia-onb-choice"}
            onClick={() =>
              setProfile((prev) => ({
                ...prev,
                user_type: "online",
                membership_status: "online_user",
                gym_id: null,
                gym_name: null,
              }))
            }
          >
            <span className="ia-onb-choice-title">Online user</span>
            <span className="ia-onb-choice-subtitle">
              Use Iron Acre for digital coaching, workouts and nutrition without gym class updates.
            </span>
          </button>
        </div>
      </section>
    </>
  );
}

export function FinishStep({
  profile,
  targets,
  age,
  canShowTargets,
}: {
  profile: UsersDoc;
  targets: MacroTargets;
  age: number;
  canShowTargets: boolean;
}) {
  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="ia-kicker">
        <i className="fas fa-flag-checkered" />
        finish
      </div>

      <div className="ia-card-title-compact mt-2">Your setup is nearly done</div>
      <div className="text-dim small mt-1">
        Review the details below and save your onboarding to continue into the app.
      </div>

      <div className="row g-2 mt-2">
        <Summary label="Sex" value={profile.sex || "—"} />
        <Summary label="Age" value={profile.DOB ? String(age) : "—"} />
        <Summary label="Height" value={profile.height_cm ? `${formatNumber(profile.height_cm)} cm` : "—"} />
        <Summary label="Weight" value={profile.weight_kg ? `${formatNumber(profile.weight_kg)} kg` : "—"} />
        <Summary label="Goal" value={getGoalLabel(profile.goal_primary)} />
        <Summary
          label="Activity"
          value={ACTIVITY_OPTIONS.find((x) => x.job_type === profile.job_type)?.title || "—"}
        />
        <Summary label="Programme" value={profile.program_name || profile.program_id || "—"} />
        <Summary label="Access" value={getUserTypeTitle(profile.user_type, profile.gym_name)} />
      </div>

      <div className="ia-tile ia-tile-pad mt-3">
        <div className="ia-kicker">
          <i className="fas fa-bullseye" />
          nutrition targets
        </div>

        {!canShowTargets ? (
          <div className="text-dim small mt-2">
            Complete the previous steps to calculate your daily targets.
          </div>
        ) : (
          <div className="row g-2 mt-2">
            <Summary label="Calories" value={formatNumber(targets.caloric_target)} small />
            <Summary label="Protein" value={`${formatNumber(targets.protein_target)}g`} small />
            <Summary label="Carbs" value={`${formatNumber(targets.carb_target)}g`} small />
            <Summary label="Fats" value={`${formatNumber(targets.fat_target)}g`} small />
          </div>
        )}
      </div>
    </section>
  );
}

function Summary({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className={small ? "col-6 col-md-3" : "col-12 col-md-6"}>
      <div className="ia-summary-card">
        <div className="ia-summary-label">{label}</div>
        <div className="ia-summary-value">{value}</div>
      </div>
    </div>
  );
}

export function OnboardingActions({
  isFirstStep,
  isLastStep,
  saving,
  onBack,
  onNext,
  onFinish,
}: {
  isFirstStep: boolean;
  isLastStep: boolean;
  saving: boolean;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  return (
    <section
      className="ia-tile ia-tile-pad"
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 10,
      }}
    >
      <div className="d-flex justify-content-between gap-2 flex-wrap">
        <button
          type="button"
          className="ia-btn ia-btn-muted"
          onClick={onBack}
          disabled={isFirstStep || saving}
        >
          Back
        </button>

        {!isLastStep ? (
          <button type="button" className="ia-btn ia-btn-primary" onClick={onNext} disabled={saving}>
            {saving ? "Saving..." : "Next"}
          </button>
        ) : (
          <button type="button" className="ia-btn ia-btn-primary" onClick={onFinish} disabled={saving}>
            {saving ? "Saving..." : "Finish setup"}
          </button>
        )}
      </div>
    </section>
  );
}
