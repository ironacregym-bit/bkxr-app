export default function MeetRob() {
  return (
    <section
      id="coach"
      className="py-24"
    >
      <div className="mx-auto max-w-7xl px-6">

        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">

          <div>

            <img
              src="/images/rob.jpg"
              alt="Rob coaching at Iron Acre Gym"
              className="
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
                text-[clamp(3rem,8vw,5rem)]
                font-black
                uppercase
                leading-none
              "
            >
              Meet Rob
            </h2>

            <p className="mb-6 text-xl text-white/90">
              Level 3 Personal Trainer,
              outdoor strength coach and
              founder of Iron Acre Gym.
            </p>

            <p className="mb-6 text-[#a3ad9f]">
              Rob specialises in practical,
              functional strength training
              using sandbags, kettlebells,
              sleds, carries and conditioning
              equipment rather than rows of
              machines.
            </p>

            <p className="mb-6 text-[#a3ad9f]">
              Every session is coached.
              Every member matters.
              Every workout can be scaled
              to your ability regardless of
              whether you're stepping into a
              gym for the first time or have
              years of training behind you.
            </p>

            <p className="text-[#a3ad9f]">
              The goal isn't bodybuilding.
              It's becoming stronger, fitter,
              healthier and more capable in
              everyday life.
            </p>

          </div>

        </div>

      </div>
    </section>
  );
}
