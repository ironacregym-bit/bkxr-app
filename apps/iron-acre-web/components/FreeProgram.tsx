import { Button } from "./ui/button";

export default function FreeProgram() {
  const days = [
    {
      day: "1",
      title: "Build The Base",
      subtitle: "Full Body Strength · 30 mins",
    },
    {
      day: "2",
      title: "Get Moving",
      subtitle: "Conditioning · 25 mins",
    },
    {
      day: "3",
      title: "Carry It",
      subtitle: "Carries & Core · 25 mins",
    },
    {
      day: "4",
      title: "Legs & Hinge",
      subtitle: "Lower Body Strength · 35 mins",
    },
    {
      day: "5",
      title: "Push & Pull",
      subtitle: "Upper Body Strength · 35 mins",
    },
    {
      day: "6",
      title: "The Finisher",
      subtitle: "Conditioning · 30 mins",
    },
    {
      day: "7",
      title: "Get Outside",
      subtitle: "Recovery Day",
    },
  ];

  return (
    <section className="bg-[#141a15] py-24">

      <div className="mx-auto max-w-6xl px-6">

        <div className="mb-16">

          <div className="mb-4 uppercase tracking-[0.2em] text-[#cc5500] font-bold">
            FREE PROGRAM
          </div>

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
            7 Day Program
          </h2>

          <p className="max-w-3xl text-xl text-white/70">
            Seven simple days designed to get you moving,
            exercising and building momentum immediately.
            No gym membership required.
          </p>

        </div>

        <div className="border-t border-white/10">

          {days.map((item) => (
            <div
              key={item.day}
              className="
                grid
                gap-6
                border-b
                border-white/10
                py-8
                md:grid-cols-[80px_1fr]
              "
            >

              <div
                className="
                  font-['Big_Shoulders_Display']
                  text-6xl
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

                <p className="mt-2 text-lg text-white/60">
                  {item.subtitle}
                </p>

              </div>

            </div>
          ))}

        </div>

        <div
          className="
            mt-16
            flex
            flex-col
            gap-6
            md:flex-row
            md:items-center
            md:justify-between
          "
        >

          <div>

            <h3
              className="
                font-['Big_Shoulders_Display']
                text-4xl
                font-black
                uppercase
              "
            >
              Ready To Start?
            </h3>

            <p className="text-white/60">
              Claim your free class and get the full program.
            </p>

          </div>

          <Button
            size="lg"
            onClick={() =>
              document
                .getElementById("start")
                ?.scrollIntoView({
                  behavior: "smooth",
                })
            }
          >
            Get The Program
          </Button>

        </div>

      </div>

    </section>
  );
}
