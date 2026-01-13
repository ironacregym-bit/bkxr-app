
// components/Onboarding/StepFinishTrial.tsx
type Props = {
  subscription_status: string | null | undefined;
  saving: boolean;
  startTrial: () => void;
  finish: () => void;
  ACCENT: string;
  isFirstStep: boolean;
  back: () => void;
};

export default function StepFinishTrial({
  subscription_status,
  saving,
  startTrial,
  finish,
  ACCENT,
  isFirstStep,
  back,
}: Props) {
  const showTrial =
    subscription_status !== "active" && subscription_status !== "trialing";

  return (
    <section
      className="futuristic-card p-4 mb-3 d-flex flex-column justify-content-between"
      style={{ minHeight: "65vh" }}
    >
      {/* Premium trial offer (single parent card only) */}
      {showTrial && (
        <div className="mb-3">
          <h5 className="mb-2">Try Premium Features — 14‑Day Free Trial</h5>
          <p className="text-dim">
            Unlock everything in BXKR Premium: advanced boxing & kettlebell
            programming, progress analytics, habit automation, nutrition
            insights, and priority updates.
          </p>
          <ul className="small text-dim mb-3" style={{ paddingLeft: "1.2rem" }}>
            <li>No card required today</li>
            <li>Cancel anytime</li>
            <li>Full premium access for 14 days</li>
          </ul>

          <div className="d-flex gap-2">
            <button
              className="btn btn-bxkr"
              onClick={startTrial}
              disabled={saving}
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                borderRadius: 24,
              }}
            >
              {saving ? "Starting…" : "Start Free Premium Trial"}
            </button>
          </div>
        </div>
      )}

      {/* Completion message (still within the single parent card) */}
      <div className="mb-3">
        <h5 className="mb-2">All Set on the Free Tier</h5>
        <p className="text-dim mb-0">
          Your onboarding details are saved. You’re on the <strong>free tier</strong>:
          core workout tracking and basic features. Upgrade to Premium anytime
          for full plans, deeper analytics, weekly coaching‑style nudges, and
          priority updates.
        </p>
      </div>

      {/* Local navigation for this step */}
      <div className="d-flex justify-content-between">
        <button
          className="btn btn-bxkr-outline"
          onClick={back}
          disabled={isFirstStep || saving}
        >
          ← Back
        </button>
        <button
          className="btn btn-bxkr"
          onClick={finish}
          disabled={saving}
          style={{
            background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
            borderRadius: 24,
          }}
        >
          Finish → Home
          {saving && <span className="inline-spinner ms-2" />}
        </button>
      </div>
    </section>
  );
}
