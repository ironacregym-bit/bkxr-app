// OnboardingHeader.tsx
import { STEPS, stepIndex } from "./onboardingUtils";
import type { StepKey } from "./onboardingTypes";

export default function OnboardingHeader({
  step,
  dirty,
  savedMsg,
}: {
  step: StepKey;
  dirty: boolean;
  savedMsg: string | null;
}) {
  const progressPct = ((stepIndex(step) + 1) / STEPS.length) * 100;

  return (
    <header className="container py-2" style={{ color: "#fff" }}>
      <section className="ia-tile ia-tile-pad">
        <div className="d-flex justify-content-between align-items-start gap-2">
          <div style={{ minWidth: 0 }}>
            <div className="ia-kicker">
              <i className="fas fa-sliders-h" />
              onboarding
            </div>

            <div className="ia-page-title">Let’s tailor Iron Acre to you</div>

            <div className="ia-page-subtitle">
              Step {stepIndex(step) + 1} of {STEPS.length}. Complete your profile so we can set better calories, macros and training.
            </div>
          </div>

          <div className="d-flex flex-column align-items-end gap-2">
            {dirty ? <span className="ia-badge">Unsaved</span> : null}
            {!dirty && savedMsg ? <span className="ia-inline-note-success">{savedMsg}</span> : null}
          </div>
        </div>

        <div
          className="mt-3"
          style={{
            height: 8,
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: "100%",
              background: "linear-gradient(90deg, var(--ia-neon), var(--ia-neon2))",
            }}
          />
        </div>
      </section>
    </header>
  );
}
