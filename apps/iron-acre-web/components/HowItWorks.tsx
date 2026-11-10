import { Container } from "./ui/container";

export default function HowItWorks() {
  const steps = [
    {
      label: "TODAY",
      title: "GET YOUR PLAN",
      description:
        "Your 7-day program unlocks instantly. Claim your free class spot to use in your first week.",
    },
    {
      label: "DAYS 1 TO 3",
      title: "TRAIN. CHECK IN.",
      description:
        "Complete your sessions, learn the basics and share your progress with the community.",
    },
    {
      label: "DAY 4",
      title: "SEE INSIDE COACHING",
      description:
        "Discover what personalised coaching looks like with no pressure or commitment.",
    },
    {
      label: "DAY 7",
      title: "CHOOSE YOUR NEXT STEP",
      description:
        "Look back at your week, then continue with coaching, classes or community support.",
    },
  ];

  return (
    <section className="py-24">

      <Container>

        <div className="lg:pl-32">

          <div className="mb-4 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
            HOW IT WORKS
          </div>

          <h2
            className="
              mb-8
              font-['Big_Shoulders_Display']
              text-[clamp(4rem,8vw,7rem)]
              font-black
              uppercase
              leading-[0.85]
            "
          >
            Your Journey
            Starts Here
          </h2>

          <p className="mb-16 max-w-3xl text-xl text-white/70">
            It all runs from the day you join,
            so there's never a wrong time to start.
          </p>

          <div className="border-t border-white/10">

            {steps.map((step) => (
              <div
                key={step.label}
                className="
                  grid
                  gap-6
                  border-b
                  border-white/10
                  py-10
                  md:grid-cols-[220px_1fr]
                "
              >
                <div
                  className="
                    font-['Big_Shoulders_Display']
                    text-4xl
                    font-black
                    uppercase
                    text-[#cc5500]
                  "
                >
                  {step.label}
                </div>

                <div>

                  <h3
                    className="
                      mb-3
                      font-['Big_Shoulders_Display']
                      text-4xl
                      font-black
                      uppercase
                    "
                  >
                    {step.title}
                  </h3>

                  <p className="max-w-3xl text-xl text-white/70">
                    {step.description}
                  </p>

                </div>

              </div>
            ))}

          </div>

        </div>

      </Container>

    </section>
  );
}
