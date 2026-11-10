import { Card } from "./ui/card";

export default function FreeProgram() {
  const days = [
    {
      day: "01",
      title: "Build The Base",
      description:
        "Full body strength session focusing on movement quality and getting started.",
    },
    {
      day: "02",
      title: "Get Moving",
      description:
        "Conditioning workout designed to improve fitness and work capacity.",
    },
    {
      day: "03",
      title: "Carry It",
      description:
        "Carries, grip strength and core training.",
    },
    {
      day: "04",
      title: "Legs & Hinge",
      description:
        "Lower body strength using simple but effective movements.",
    },
    {
      day: "05",
      title: "Push & Pull",
      description:
        "Upper body strength and muscular endurance.",
    },
    {
      day: "06",
      title: "The Finisher",
      description:
        "Full body conditioning session.",
    },
    {
      day: "07",
      title: "Get Outside",
      description:
        "Recovery, walking and mobility work.",
    },
  ];

  return (
    <section className="bg-[#1b231c] py-24">
      <div className="mx-auto max-w-7xl px-6">

        <div className="mb-12">
          <div className="mb-4 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
            FREE PROGRAM
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
            Your Free
            <br />
            7 Day Program
          </h2>

          <p className="max-w-3xl text-xl text-white/90">
            Six short sessions and one recovery day.
            Designed to get you moving immediately.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">

          {days.map((item) => (
            <Card
              key={item.day}
              className="
                border-[#2e3a2f]
                bg-[#141a15]
              "
            >
              <div className="mb-2 text-sm font-bold tracking-[0.15em] text-[#cc5500]">
                DAY {item.day}
              </div>

              <h3
                className="
                  mb-3
                  font-['Big_Shoulders_Display']
                  text-3xl
                  font-black
                  uppercase
                "
              >
                {item.title}
              </h3>

              <p className="text-[#a3ad9f]">
                {item.description}
              </p>

            </Card>
          ))}

        </div>

      </div>
    </section>
  );
}
