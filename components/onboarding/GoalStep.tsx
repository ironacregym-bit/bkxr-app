import type { GoalPrimary, SetProfile, UsersDoc } from "./onboardingTypes";
import { ACTIVITY_OPTIONS } from "./onboardingUtils";

function ChoiceButton({
  selected,
  title,
  subtitle,
  onClick,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={selected ? "ia-onb-choice ia-onb-choice-selected" : "ia-onb-choice"}
      onClick={onClick}
    >
      <span className="ia-onb-choice-title">{title}</span>
      <span className="ia-onb-choice-subtitle">{subtitle}</span>
    </button>
  );
}

export default function GoalStep({
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
          ].map((opt) => (
            <ChoiceButton
              key={opt.value}
              selected={profile.goal_primary === opt.value}
              title={opt.title}
              subtitle={opt.subtitle}
              onClick={() =>
                setProfile((prev) => ({
                  ...prev,
                  goal_primary: opt.value as GoalPrimary,
                }))
              }
            />
          ))}
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
          {ACTIVITY_OPTIONS.map((opt) => (
            <ChoiceButton
              key={opt.job_type || opt.title}
              selected={profile.job_type === opt.job_type}
              title={opt.title}
              subtitle={opt.subtitle}
              onClick={() =>
                setProfile((prev) => ({
                  ...prev,
                  job_type: opt.job_type,
                  activity_factor: opt.factor,
                }))
              }
            />
          ))}
        </div>
      </section>
    </>
  );
}
