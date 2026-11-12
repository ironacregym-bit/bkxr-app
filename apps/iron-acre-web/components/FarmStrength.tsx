import { BackgroundSection } from "./ui/background-section";
import { Container } from "./ui/container";

export default function FarmStrength() {
  return (
    <BackgroundSection
      image="/images/farm-strength.jpg"
      overlayClassName="
        bg-gradient-to-b
        from-black/80
        via-black/60
        to-black/90
      "
    >
      <Container>

        <div className="mb-10">

          <div className="mb-3 uppercase tracking-[0.15em] text-[#cc5500] text-sm font-bold">
            MON & WED · 6:30PM
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
            Farm Strength & Conditioning
          </h2>

          <p className="max-w-2xl text-base text-white/80">
            Strongman-inspired outdoor
            training for everyday people.
          </p>

        </div>

        <div className="grid gap-6 md:grid-cols-3">

          <div>

            <h3 className="mb-2 font-['Big_Shoulders_Display'] text-xl font-black uppercase">
              Strength
            </h3>

            <p className="text-white/65">
              Sandbags, kettlebells,
              yokes and sled pushes.
            </p>

          </div>

          <div>

            <h3 className="mb-2 font-['Big_Shoulders_Display'] text-xl font-black uppercase">
              Conditioning
            </h3>

            <p className="text-white/65">
              Carries, circuits,
              SkiErg and BikeErg work.
            </p>

          </div>

          <div>

            <h3 className="mb-2 font-['Big_Shoulders_Display'] text-xl font-black uppercase">
              For Everyone
            </h3>

            <p className="text-white/65">
              Complete beginner or experienced lifter,
              everything scales.
            </p>

          </div>

        </div>

      </Container>

    </BackgroundSection>
  );
}
