import { Button } from "./ui/button";
import { Card } from "./ui/card";

export default function Coaching() {
  return (
    <section
      id="coaching"
      className="bg-[#1b231c] py-24"
    >
      <div className="mx-auto max-w-7xl px-6">

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
              leading-none
            "
          >
            £75 Per Month
          </h2>

          <p className="max-w-3xl text-xl text-white/90">
            Personalised coaching built around your
            equipment, goals and lifestyle.
          </p>

        </div>

        <div className="grid gap-6 lg:grid-cols-3">

          <Card className="border-[#2e3a2f] bg-[#141a15]">
            <h3
              className="
                mb-4
                font-['Big_Shoulders_Display']
                text-3xl
                font-black
                uppercase
              "
            >
              Training Plan
            </h3>

            <p className="text-[#a3ad9f]">
              Individual programming focused
              on strength, conditioning and
              long-term consistency.
            </p>
          </Card>

          <Card className="border-[#2e3a2f] bg-[#141a15]">
            <h3
              className="
                mb-4
                font-['Big_Shoulders_Display']
                text-3xl
                font-black
                uppercase
              "
            >
              Weekly Support
            </h3>

            <p className="text-[#a3ad9f]">
              Regular check-ins, accountability,
              technique feedback and direct
              coach support.
            </p>
          </Card>

          <Card className="border-[#2e3a2f] bg-[#141a15]">
            <h3
              className="
                mb-4
                font-['Big_Shoulders_Display']
                text-3xl
                font-black
                uppercase
              "
            >
              Community Access
            </h3>

            <p className="text-[#a3ad9f]">
              Join challenges, events and a
              supportive group working towards
              the same goals.
            </p>
          </Card>

        </div>

        <div className="mt-12">

          <Button
            size="lg"
            onClick={() => {
              document
                .getElementById("start")
                ?.scrollIntoView({
                  behavior: "smooth",
                });
            }}
          >
            Apply For Coaching
          </Button>

        </div>

      </div>
    </section>
  );
}
