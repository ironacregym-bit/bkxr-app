import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

export default function Coaching() {
  return (
    <section
      id="coaching"
      className="py-24"
    >
      <div className="mx-auto max-w-7xl px-6">

        <div className="mb-12">

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
            Online Coaching.
            <br />
            20 Places.
          </h2>

          <p className="max-w-4xl text-xl text-white/70">
            A coach, a plan and a community,
            adapted to the equipment you have.
            We cap coaching at 20 members so
            everyone receives personal attention.
          </p>

        </div>

        <Card
          className="
            border-[#cc5500]
            bg-transparent
            p-10
          "
        >
          <div className="grid gap-12 lg:grid-cols-2">

            <div>

              <div className="mb-6">

                <span className="mr-3 text-4xl text-white/30 line-through">
                  £100
                </span>

                <span
                  className="
                    font-['Big_Shoulders_Display']
                    text-8xl
                    font-black
                    text-[#cc5500]
                  "
                >
                  £75
                </span>

                <span className="ml-2 text-2xl text-white/60">
                  / month
                </span>

              </div>

              <ul className="space-y-4 text-lg text-white/80">

                <li>
                  • Training adapted to your
                  equipment and goals
                </li>

                <li>
                  • 2 to 4 strength sessions
                  each week
                </li>

                <li>
                  • Cardio guidance
                </li>

                <li>
                  • Nutrition support
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
                  font-semibold
                  text-2xl
                "
              >
                Only 20 places.
                Apply now to be considered.
              </h3>

              <div className="space-y-4">

                <Input
                  placeholder="First name"
                />

                <Input
                  placeholder="Email address"
                />

                <Button
                  className="
                    h-12
                    w-full
                    text-lg
                  "
                >
                  Apply For My Place
                </Button>

              </div>

              <p className="mt-4 text-white/50">
                Not ready?
                Start with the free 7 day
                program first.
              </p>

            </div>

          </div>

        </Card>

      </div>
    </section>
  );
}
