export default function FreeProgram() {
  const days = [
    {
      day: "1",
      title: "BUILD THE BASE",
      subtitle: "Full-body strength · 30 min",
      description:
        "Learn the fundamentals and build confidence with simple full-body strength work.",
    },
    {
      day: "2",
      title: "GET MOVING",
      subtitle: "Conditioning · 25 min",
    },
    {
      day: "3",
      title: "CARRY IT",
      subtitle: "Carries & Core · 25 min",
    },
    {
      day: "4",
      title: "LEGS AND HINGE",
      subtitle: "Lower Body · 35 min",
    },
    {
      day: "5",
      title: "PUSH AND PULL",
      subtitle: "Upper Body · 35 min",
    },
    {
      day: "6",
      title: "FINISHER",
      subtitle: "Conditioning · 30 min",
    },
    {
      day: "7",
      title: "GET OUTSIDE",
      subtitle: "Recovery Day",
    },
  ];

  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">

        <h2
          className="
            mb-6
            font-['Big_Shoulders_Display']
            text-[clamp(4rem,10vw,7rem)]
            font-black
            uppercase
            leading-[0.85]
          "
        >
          Your Free
          <br />
          7-Day Program
        </h2>

        <p className="mb-8 max-w-4xl text-xl text-white/70">
          Six short sessions and one recovery day.
          Scale it down if you're new.
        </p>

        <div className="mb-12 flex flex-wrap gap-3">

          <span className="rounded-full border border-white/10 px-5 py-2 text-white/70">
            One kettlebell or loaded backpack
          </span>

          <span className="rounded-full border border-white/10 px-5 py-2 text-white/70">
            Floor space
          </span>

          <span className="rounded-full border border-white/10 px-5 py-2 text-white/70">
            A timer
          </span>

        </div>

        <div className="border-t border-white/10">

          {days.map((item, index) => (
            <div
              key={item.day}
              className="
                grid
                gap-6
                border-b
                border-white/10
                py-8
                md:grid-cols-[60px_1fr]
              "
            >

              <div
                className="
                  font-['Big_Shoulders_Display']
                  text-5xl
                  font-black
                  text-[#cc5500]
                "
              >
                {item.day}
              </div>

              <div>

                <h3
                  className="
                    font-['Big_Shoulders_Display']
                    text-4xl
                    font-black
                    uppercase
                  "
                >
                  {item.title}
                </h3>

                <p className="mt-1 text-white/50">
                  {item.subtitle}
                </p>

                {index === 0 && item.description && (
                  <div className="mt-6">

                    <ul className="space-y-3 text-lg text-white/80">

                      <li>
                        • Warm up:
                        easy marching,
                        hip hinges
                        and arm circles.
                      </li>

                      <li>
                        • Goblet squats,
                        push-ups,
                        rows
                        and plank work.
                      </li>

                      <li>
                        • Finish with
                        a short walk.
                      </li>

                    </ul>

                  </div>
                )}

              </div>

            </div>
          ))}

        </div>

      </div>
    </section>
  );
}
