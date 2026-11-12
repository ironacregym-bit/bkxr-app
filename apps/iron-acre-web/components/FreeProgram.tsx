import { Button } from "./ui/button";
import { Container } from "./ui/container";

export default function FreeProgram() {
  const days = [
    { day: "1", title: "Build The Base", subtitle: "Full Body Strength" },
    { day: "2", title: "Get Moving", subtitle: "Conditioning" },
    { day: "3", title: "Carry It", subtitle: "Carries & Core" },
    { day: "4", title: "Legs & Hinge", subtitle: "Lower Body Strength" },
    { day: "5", title: "Push & Pull", subtitle: "Upper Body Strength" },
    { day: "6", title: "The Finisher", subtitle: "Conditioning" },
    { day: "7", title: "Get Outside", subtitle: "Recovery Day" },
  ];

  return (
    <section className="bg-[#141a15] py-16">

      <Container>

        <div className="mb-10">

          <div className="mb-3 uppercase tracking-[0.15em] text-[#cc5500] text-sm font-bold">
            FREE PROGRAM
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
            Your Free 7 Day Program
          </h2>

          <p className="max-w-2xl text-base text-white/65">
            Seven simple days designed to get you moving immediately.
          </p>

        </div>

        <div className="border-t border-white/10">

          {days.map((item) => (
            <div
              key={item.day}
              className="
                grid
                gap-4
                border-b
                border-white/10
                py-6
                md:grid-cols-[60px_1fr]
              "
            >
              <div
                className="
                  font-['Big_Shoulders_Display']
                  text-3xl
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
                    text-2xl
                    font-black
                    uppercase
                  "
                >
                  {item.title}
                </h3>

                <p className="text-white/60">
                  {item.subtitle}
                </p>

              </div>

            </div>
          ))}

        </div>

        <div className="mt-10">

          <Button>
            Get The Program
          </Button>

        </div>

      </Container>

    </section>
  );
}
