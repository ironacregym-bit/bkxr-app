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

        <div className="lg:pl-32">

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
              leading-[0.85]
            "
          >
            Farm Strength &
            Conditioning
          </h2>

          <p className="max-w-3xl text-xl text-white/90">
            Strongman-inspired outdoor
            training for everyday people.
          </p>

          <div className="mt-16 grid gap-10 md:grid-cols-3">

            <div className="border-l-2 border-[#cc5500] pl-5">

              <h3
                className="
                  mb-4
                  font-['Big_Shoulders_Display']
                  text-4xl
                  font-black
                  uppercase
                "
              >
                Strength
              </h3>

              <p className="text-white/80">
                Sandbags, kettlebells,
                yokes and sled pushes.
              </p>

            </div>

            <div className="border-l-2 border-[#cc5500] pl-5">

              <h3
                className="
                  mb-4
                  font-['Big_Shoulders_Display']
                  text-4xl
                  font-black
                  uppercase
                "
              >
                Conditioning
              </h3>

              <p className="text-white/80">
                Carries, circuits,
                SkiErg and BikeErg work.
              </p>

            </div>

            <div className="border-l-2 border-[#cc5500] pl-5">

              <h3
                className="
                  mb-4
                  font-['Big_Shoulders_Display']
                  text-4xl
                  font-black
                  uppercase
                "
              >
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

      </Container>
    </BackgroundSection>
  );
}
