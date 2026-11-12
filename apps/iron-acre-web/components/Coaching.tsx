import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Container } from "./container";

export default function Coaching() {
  return (
    <Container>
      <section
        id="coaching"
        className="bg-[#141a15] py-24 text-white"
      >
        <div className="mx-auto max-w-6xl px-6">
  
          <div className="mb-16">
  
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
              A coach, a plan and a crew,
              adapted to the equipment you have.
              Whatever you train with, the aim
              is farm strength.
              We cap coaching at 20 members so
              everyone receives personal attention.
            </p>
  
          </div>
  
          <Card
            className="
              border-2
              border-[#cc5500]
              bg-[#1b231c]
              p-8
              text-white
              shadow-none
            "
          >
            <div className="grid gap-12 lg:grid-cols-2">
  
              <div>
  
                <div className="mb-8">
  
                  <div className="mb-2 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
                    Founding Member Rate
                  </div>
  
                  <div className="flex flex-wrap items-end gap-3">
  
                    <span className="text-4xl text-white/30 line-through">
                      £100
                    </span>
  
                    <span
                      className="
                        font-['Big_Shoulders_Display']
                        text-8xl
                        font-black
                        leading-none
                        text-[#cc5500]
                      "
                    >
                      £75
                    </span>
  
                    <span className="mb-2 text-3xl text-white/60">
                      / month
                    </span>
  
                  </div>
  
                </div>
  
                <ul className="space-y-5 text-xl text-white/80">
  
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
                    mb-8
                    font-['Big_Shoulders_Display']
                    text-4xl
                    font-black
                    uppercase
                  "
                >
                  Only 20 places.
                  <br />
                  Apply now.
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
                      h-14
                      w-full
                      bg-[#cc5500]
                      text-lg
                      hover:bg-[#db6712]
                    "
                  >
                    Apply For My Place
                  </Button>
  
                </div>
  
                <p className="mt-6 text-white/50">
                  Not ready?
                  Start with the free 7 day program first.
                </p>
  
              </div>
  
            </div>
  
          </Card>
  
        </div>
      </Container>
    </section>
  );
}
