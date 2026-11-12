import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Container } from "./ui/container";

export default function Coaching() {
  return (
    <section
      id="coaching"
      className="bg-[#141a15] py-20 text-white"
    >
      <Container>

        <div className="mb-12">

          <div className="mb-4 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
            ONLINE COACHING
          </div>

          <h2
            className="
              mb-6
              font-['Big_Shoulders_Display']
              text-[clamp(3rem,8vw,5rem)]
              font-black
              uppercase
              leading-[0.85]
            "
          >
            Online Coaching.
            <br />
            20 Places.
          </h2>

          <p className="max-w-3xl text-lg text-white/70">
            A coach, a plan and a community,
            adapted to the equipment you have.
            Whatever you train with, the aim
            is farm strength.
          </p>

        </div>

        <Card
          className="
            border-2
            border-[#cc5500]
            bg-[#1b231c]
            p-6
            text-white
            shadow-none
          "
        >
          <div className="grid gap-8 lg:grid-cols-2">

            <div>

              <div className="mb-6">

                <div className="mb-2 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
                  Founding Member Rate
                </div>

                <div className="flex flex-wrap items-end gap-3">

                  <span className="text-2xl text-white/30 line-through">
                    £100
                  </span>

                  <span
                    className="
                      font-['Big_Shoulders_Display']
                      text-6xl
                      font-black
                      leading-none
                      text-[#cc5500]
                    "
                  >
                    £75
                  </span>

                  <span className="mb-1 text-xl text-white/60">
                    / month
                  </span>

                </div>

              </div>

              <ul className="space-y-4 text-base text-white/80">

                <li>
                  • Training adapted to your equipment and goals
                </li>

                <li>
                  • 2 to 3 strength sessions each week
                </li>

                <li>
                  • 1 to 2 cardio sessions each week
                </li>

                <li>
                  • Calories and macros worked out for you
                </li>

                <li>
                  • Iron Acre app access
                </li>

                <li>
                  • Community access
                </li>

                <li>
                  • Weekly coach check-ins
                </li>

              </ul>

            </div>

            <div>

              <h3
                className="
                  mb-6
                  font-['Big_Shoulders_Display']
                  text-3xl
                  font-black
                  uppercase
                  leading-none
                "
              >
                Only 20 Places.
                <br />
                Apply Now.
              </h3>

              <div className="space-y-4">

                <Input
                  placeholder="First name"
                  className="bg-white"
                />

                <Input
                  placeholder="Email address"
                  className="bg-white"
                />

                <Button
                  className="
                    h-12
                    w-full
                    bg-[#cc5500]
                    text-base
                    hover:bg-[#db6712]
                  "
                >
                  Apply For My Place
                </Button>

              </div>

              <p className="mt-5 text-sm text-white/50">
                Not ready? Start with the free
                7 day program first.
              </p>

            </div>

          </div>

        </Card>

      </Container>
    </section>
  );
}
