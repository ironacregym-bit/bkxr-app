import type { MacroTargets, UsersDoc } from "./onboardingTypes";
import {
  ACTIVITY_OPTIONS,
  accessLabel,
  billingLabel,
  formatNumber,
  goalLabel,
} from "./onboardingUtils";

function SummaryCard({
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

export default function FinishStep({
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
        <SummaryCard label="Sex" value={profile.sex || "—"} />
        <SummaryCard label="Age" value={profile.DOB ? String(age) : "—"} />
        <SummaryCard label="Height" value={profile.height_cm ? `${formatNumber(profile.height_cm)} cm` : "—"} />
        <SummaryCard label="Weight" value={profile.weight_kg ? `${formatNumber(profile.weight_kg)} kg` : "—"} />
        <SummaryCard label="Goal" value={goalLabel(profile.goal_primary)} />
        <SummaryCard
          label="Activity"
          value={ACTIVITY_OPTIONS.find((x) => x.job_type === profile.job_type)?.title || "—"}
        />
        <SummaryCard label="Programme" value={profile.program_name || profile.program_id || "—"} />
        <SummaryCard label="Access" value={accessLabel(profile)} />
        <SummaryCard label="Billing" value={billingLabel(profile)} />
        <SummaryCard
          label="PAR-Q"
          value={
            profile.user_type === "gym"
              ? profile.parq_status === "completed"
                ? "Completed"
                : "Not completed"
              : "Not required"
          }
        />
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
            <SummaryCard label="Calories" value={formatNumber(targets.caloric_target)} small />
            <SummaryCard label="Protein" value={`${formatNumber(targets.protein_target)}g`} small />
            <SummaryCard label="Carbs" value={`${formatNumber(targets.carb_target)}g`} small />
            <SummaryCard label="Fats" value={`${formatNumber(targets.fat_target)}g`} small />
          </div>
        )}
      </div>
    </section>
  );
}
