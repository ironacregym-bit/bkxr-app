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
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">

        <div className="mb-12">

          <div className="mb-4 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
            HOW IT WORKS
          </div>

          <h2
            className="
              mb-6
              font-['Big_Shoulders_Display']
              text-[clamp(3rem,8vw,5rem)]
              font-black
              uppercase
              leading-none
            "
          >
            Your Journey
            Starts Here
          </h2>

          <p className="max-w-3xl text-xl text-white/90">
            Everything is designed to help you build strength,
            fitness and consistency without feeling overwhelmed.
          </p>

        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">

          {steps.map((step) => (
            <div
              key={step.title}
              className="
                border-l-4
                border-[#cc5500]
                pl-4
              "
            >
              <div className="mb-2 text-sm uppercase tracking-[0.15em] text-[#cc5500] font-bold">
                {step.label}
              </div>

              <h3
                className="
                  mb-3
                  font-['Big_Shoulders_Display']
                  text-3xl
                  font-black
                  uppercase
                "
              >
                {step.title}
              </h3>

              <p className="text-[#a3ad9f]">
                {step.description}
              </p>

            </div>
          ))}

        </div>

      </div>
    </section>
  );
}
