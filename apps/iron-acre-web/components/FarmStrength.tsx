export default function FarmStrength() {
  return (
    <section
      id="class"
      className="bg-[#1b231c] py-24"
    >
      <div className="mx-auto max-w-7xl px-6">

        <div className="mb-4 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
          MON & WED · 6:30PM
        </div>

        <h2 className="mb-6 font-['Big_Shoulders_Display'] text-[clamp(3rem,8vw,5rem)] font-black uppercase leading-none">
          Farm Strength &
          Conditioning
        </h2>

        <p className="max-w-3xl text-xl text-white/90">
          Strongman-inspired outdoor training
          for everyday people.
        </p>

        <div className="mt-12 grid gap-10 md:grid-cols-3">

          <div className="border-l-4 border-[#cc5500] pl-4">

            <h3 className="mb-3 font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
              Strength
            </h3>

            <p className="text-[#a3ad9f]">
              Sandbags, yokes, kettlebells
              and sleds.
            </p>

          </div>

          <div className="border-l-4 border-[#cc5500] pl-4">

            <h3 className="mb-3 font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
              Conditioning
            </h3>

            <p className="text-[#a3ad9f]">
              SkiErg, BikeErg, carries
              and circuits.
            </p>

          </div>

          <div className="border-l-4 border-[#cc5500] pl-4">

            <h3 className="mb-3 font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
              For Everyone
            </h3>

            <p className="text-[#a3ad9f]">
              Every exercise scales to
              your ability.
            </p>

          </div>

        </div>

      </div>
    </section>
  );
}
