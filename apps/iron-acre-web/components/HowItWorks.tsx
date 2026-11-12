import { Container } from "./ui/container";

export default function HowItWorks() {
  const steps = [
    {
      label: "TODAY",
      title: "GET YOUR PLAN",
      description:
        "Claim your free class and unlock your starter programme.",
    },
    {
      label: "DAYS 1-3",
      title: "TRAIN. CHECK IN.",
      description:
        "Complete your first sessions and build momentum.",
    },
    {
      label: "DAY 4",
      title: "SEE INSIDE COACHING",
      description:
        "Discover how personalised coaching works.",
    },
    {
      label: "DAY 7",
      title: "CHOOSE YOUR NEXT STEP",
      description:
        "Continue with classes, coaching or community support.",
    },
  ];

  return (
    <section className="py-16">

      <Container>

        <div className="mb-10">

          <div className="mb-3 uppercase tracking-[0.15em] text-[#cc5500] text-sm font-bold">
            HOW IT WORKS
          </div>

          <h2
            className="
              mb-4
              font-['Big_Shoulders_Display']
              text-[clamp(2.5rem,5vw,4rem)]
              font-black
              uppercase
              leading-none
            "
          >
            Your Journey Starts Here
          </h2>

        </div>

        <div className="border-t border-white/10">

          {steps.map((step) => (
            <div
              key={step.label}
              className="
                grid
                gap-4
                border-b
                border-white/10
                py-6
                md:grid-cols-[140px_1fr]
              "
            >
              <div
                className="
                  font-['Big_Shoulders_Display']
                  text-2xl
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
                    mb-2
                    font-['Big_Shoulders_Display']
                    text-2xl
                    font-black
                    uppercase
                  "
                >
                  {step.title}
                </h3>

                <p className="text-base text-white/65">
                  {step.description}
                </p>

              </div>

            </div>
          ))}

        </div>

      </Container>

    </section>
  );
}
