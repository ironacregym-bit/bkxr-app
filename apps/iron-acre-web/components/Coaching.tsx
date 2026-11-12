import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Container } from "./ui/container";
import CoachingLeadCapture from "./CoachingLeadCapture";

export default function Coaching() {
  return (
    <section
      id="coaching"
      className="bg-[#141a15] py-16 text-white"
    >
      <Container>

        <div className="mb-10">

          <div className="mb-3 uppercase tracking-[0.15em] text-[#cc5500] text-sm font-bold">
            ONLINE COACHING
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
            Online Coaching. 20 Places.
          </h2>

          <p className="max-w-3xl text-base text-white/70">
            A coach, a plan and a community,
            adapted to the equipment you have.
            Whatever you train with, the aim
            is farm strength. We cap coaching
            at 20 members so everyone gets
            real attention.
          </p>

        </div>

        <Card
          className="
            border
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

                <div className="mb-2 uppercase tracking-[0.15em] text-[#cc5500] text-sm font-bold">
                  Founding Member Rate
                </div>

                <div className="flex flex-wrap items-end gap-2">

                  <span className="text-xl text-white/30 line-through">
                    £100
                  </span>

                  <span
                    className="
                      font-['Big_Shoulders_Display']
                      text-5xl
                      font-black
                      leading-none
                      text-[#cc5500]
                    "
                  >
                    £75
                  </span>

                  <span className="mb-1 text-lg text-white/60">
                    / month
                  </span>

                </div>

              </div>

              <ul className="space-y-3 text-base text-white/80">

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
                  mb-5
                  font-['Big_Shoulders_Display']
                  text-2xl
                  font-black
                  uppercase
                  leading-none
                "
              >
                Only 20 Places. Apply Now.
              </h3>

              <CoachingLeadCapture />
              
              <p className="mt-4 text-sm text-white/50">
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
