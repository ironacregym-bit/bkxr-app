import { BackgroundSection } from "./ui/background-section";

export default function FarmStrength() {
  return (
    <BackgroundSection
      image="/images/farm-strength.jpg"
    >
      <div className="mx-auto max-w-7xl px-6">

        <div className="mb-4 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
          MON & WED · 6:30PM
        </div>

        <h2
          className="
            mb-6
            font-['Big_Shoulders_Display']
            text-[clamp(4rem,8vw,7rem)]
            font-black
            uppercase
            leading-none
          "
        >
          Farm Strength &
          Conditioning
        </h2>

        <p className="max-w-3xl text-xl text-white/90">
          Strongman-inspired outdoor
          training for everyday people.
        </p>

        <div className="mt-12 grid gap-8 md:grid-cols-3">

          <div>
            <h3 className="mb-3 font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
              Strength
            </h3>

            <p className="text-white/80">
              Sandbags, kettlebells,
              yokes and sled pushes.
            </p>
          </div>

          <div>
            <h3 className="mb-3 font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
              Conditioning
            </h3>

            <p className="text-white/80">
              Carries, circuits,
              SkiErg and BikeErg work.
            </p>
          </div>

          <div>
            <h3 className="mb-3 font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
              For Everyone
            </h3>

            <p className="text-white/80">
              Complete beginner or
              experienced lifter,
              everything scales.
            </p>
          </div>

        </div>

      </div>
    </BackgroundSection>
  );
}
