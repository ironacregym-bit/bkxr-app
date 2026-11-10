export default function GymWithAView() {
  return (
    <section className="bg-[#1b231c] py-24">
      <div className="mx-auto max-w-6xl px-6">

        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">

          <div>

            <div className="mb-4 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
              A GYM WITH A VIEW
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
              Outdoor
              Strength
              Training
            </h2>

            <p className="mb-6 text-xl text-white/90">
              Iron Acre Gym is an outdoor gym
              in Westerfield, Ipswich overlooking
              an open meadow.
            </p>

            <p className="mb-6 text-white/70">
              Train using sandbags, kettlebells,
              sleds, yokes and carries in a unique
              working farm environment.
            </p>

            <p className="text-white/70">
              No mirrors. No queues.
              No commercial gym atmosphere.
              Just proper strength training.
            </p>

          </div>

          <div>

            <img
              src="/images/meadow.jpg"
              alt="Iron Acre meadow"
              className="
                h-[500px]
                w-full
                rounded-lg
                object-cover
                shadow-2xl
              "
            />

          </div>

        </div>

      </div>
    </section>
  );
}
