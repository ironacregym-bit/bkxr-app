export default function MeetRob() {
  return (
    <section
      id="coach"
      className="bg-[#141a15] py-24"
    >
      <div className="mx-auto max-w-5xl px-5">

        <div className="grid gap-16 lg:grid-cols-[420px_1fr] lg:items-center">

          <div>

            <img
              src="/images/rob.jpg"
              alt="Rob coaching at Iron Acre Gym"
              className="
                h-[550px]
                w-full
                rounded-lg
                object-cover
                shadow-2xl
              "
            />

          </div>

          <div>

            <div className="mb-4 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
              Meet Your Coach
            </div>

            <h2
              className="
                mb-6
                font-['Big_Shoulders_Display']
                text-[clamp(4rem,8vw,7rem)]
                font-black
                uppercase
                leading-[0.85]
              "
            >
              Meet Rob
            </h2>

            <p className="mb-8 text-xl text-white/90">
              Level 3 Personal Trainer,
              outdoor strength coach and
              founder of Iron Acre Gym.
            </p>

            <div className="space-y-6 text-lg text-white/70">

              <p>
                Rob specialises in practical,
                functional strength training using
                sandbags, kettlebells, sleds,
                yokes and carries rather than
                rows of machines.
              </p>

              <p>
                Every session is coached.
                Every member matters.
                Every workout can be scaled
                to your current fitness level.
              </p>

              <p>
                Whether you're completely new to
                training or have years of experience,
                the goal is the same:
                become stronger, fitter and more
                capable in everyday life.
              </p>

            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-3">

              <div className="border-l-2 border-[#cc5500] pl-4">

                <div
                  className="
                    font-['Big_Shoulders_Display']
                    text-3xl
                    font-black
                    uppercase
                  "
                >
                  Level 3
                </div>

                <p className="text-sm text-white/60">
                  Personal Trainer
                </p>

              </div>

              <div className="border-l-2 border-[#cc5500] pl-4">

                <div
                  className="
                    font-['Big_Shoulders_Display']
                    text-3xl
                    font-black
                    uppercase
                  "
                >
                  Outdoor
                </div>

                <p className="text-sm text-white/60">
                  Strength Coach
                </p>

              </div>

              <div className="border-l-2 border-[#cc5500] pl-4">

                <div
                  className="
                    font-['Big_Shoulders_Display']
                    text-3xl
                    font-black
                    uppercase
                  "
                >
                  Founder
                </div>

                <p className="text-sm text-white/60">
                  Iron Acre Gym
                </p>

              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
