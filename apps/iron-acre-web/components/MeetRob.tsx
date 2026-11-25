import Image from "next/image";
import { Container } from "./ui/container";

export default function MeetRob() {
  return (
    <section
      id="coach"
      className="bg-[#141a15] py-16"
    >
      <Container>

        <div className="grid gap-8 lg:grid-cols-[280px_1fr] lg:items-center">

          <div className="relative h-[360px]">

            <Image
              src="/images/Gym_side_view.JPG"
              alt="Outdoor training area at Iron Acre Gym"
              fill
              sizes="(min-width: 1024px) 280px, 100vw"
              className="rounded-lg object-cover shadow-xl"
            />
            <div className="absolute inset-x-0 bottom-0 rounded-b-lg bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-12">
              <p className="text-sm font-semibold text-white">
                Outdoor training space · Westerfield
              </p>
            </div>

          </div>

          <div>

            <div className="mb-3 uppercase tracking-[0.15em] text-[#cc5500] text-sm font-bold">
              MEET YOUR COACH
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
              Meet Rob
            </h2>

            <p className="mb-4 text-base text-white/80">
              Level 3 Personal Trainer,
              outdoor strength coach and
              founder of Iron Acre Gym.
            </p>

            <div className="space-y-3 text-base text-white/65">

              <p>
                Rob specialises in practical,
                functional strength training using
                sandbags, kettlebells, sleds,
                yokes and carries.
              </p>

              <p>
                Every session is coached.
                Every member matters.
                Every workout can be scaled
                to your ability.
              </p>

              <p>
                The goal is simple:
                become stronger, fitter and
                more capable in everyday life.
              </p>

            </div>

          </div>

        </div>

      </Container>
    </section>
  );
}
