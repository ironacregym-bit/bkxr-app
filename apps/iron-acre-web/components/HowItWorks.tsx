export default function HowItWorks() {
  const steps = [
    {
      label: "Today",
      title: "Claim Your Free Class",
      description:
        "Register your details and we'll send you everything you need to get started.",
    },
    {
      label: "Week 1",
      title: "Train With Us",
      description:
        "Join your first class, meet the community and learn how we coach.",
    },
    {
      label: "Month 1",
      title: "Build Momentum",
      description:
        "Start building strength, fitness and consistency with support from the group.",
    },
    {
      label: "Long Term",
      title: "Get Farm Strong",
      description:
        "Become stronger, fitter and more resilient for everyday life.",
    },
  ];

  return (
    <section className="ia-section">
      <div className="ia-container">

        <div className="ia-eyebrow">
          HOW IT WORKS
        </div>

        <h2>
          Your Journey Starts Here
        </h2>

        <div className="ia-cards">
          {steps.map((step) => (
            <div
              key={step.title}
              className="ia-card"
            >
              <div className="ia-eyebrow">
                {step.label}
              </div>

              <h3>
                {step.title}
              </h3>

              <p>
                {step.description}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
