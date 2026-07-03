export default function OnboardingActions({
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
