
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
    <section className="futuristic-card p-4 mb-3 d-flex flex-column justify-content-center" style={{ minHeight: "65vh" }}>
      {showTrial && (
        <div className="futuristic-card p-3 mb-3">
          <h5 className="mb-2">Start Your 14‑Day Free Trial</h5>
          <p className="text-dim">
            Unlock all BXKR features: structured boxing & kettlebell sessions, habit tracking,
            nutrition logging, weekly breakdowns and accountability.
          </p>
          <ul className="small text-dim mb-2">
            <li>No card required today</li>
            <li>Cancel anytime</li>
            <li>Full access for 14 days</li>
          </ul>
          <div className="d-flex gap-2">
            <button
              className="btn btn-bxkr"
              onClick={startTrial}
              disabled={saving}
              style={{ background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`, borderRadius: 24 }}
            >
              {saving ? "Starting…" : "Start Free Trial"}
            </button>
          </div>
        </div>
      )}

      <div className="futuristic-card p-3 mb-3">
        <h5 className="mb-2">All Set!</h5>
        <p className="text-dim">
          BXKR tailors your training to your metrics, job type, workout type and fighting style.
        </p>
      </div>

      <div className="d-flex justify-content-between" id="onb-page-nav">
        <button className="btn btn-bxkr-outline" onClick={back} disabled={isFirstStep || saving}>
          ← Back
        </button>
        <button
          className="btn btn-bxkr"
          onClick={finish}
          disabled={saving}
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`, borderRadius: 24 }}
        >
          Finish → Home
          {saving && <span className="inline-spinner ms-2" />}
        </button>
      </div>
    </section>
  );
}
