import { BackgroundSection } from "./ui/background-section";
import { Container } from "./ui/container";

export default function Community() {
  return (
    <BackgroundSection
      image="/images/community.jpg"
      overlayClassName="
        bg-gradient-to-b
        from-black/70
        via-black/60
        to-black/80
      "
    >
      <Container>

        <div className="mb-10">

          <div className="mb-3 uppercase tracking-[0.15em] text-[#cc5500] text-sm font-bold">
            COMMUNITY
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
            Nobody Trains Alone.
          </h2>

          <p className="max-w-2xl text-base text-white/80">
            The reason most people fail isn't effort.
            It's trying to do everything alone.
          </p>

        </div>

        <div className="grid gap-6 md:grid-cols-3">

          <div>

            <h3 className="mb-2 font-['Big_Shoulders_Display'] text-xl font-black uppercase">
              Daily Check-ins
            </h3>

            <p className="text-white/65">
              Accountability and support
              from people on the same journey.
            </p>

          </div>

          <div>

            <h3 className="mb-2 font-['Big_Shoulders_Display'] text-xl font-black uppercase">
              Coach Access
            </h3>

            <p className="text-white/65">
              Direct support from a real coach.
            </p>

          </div>

          <div>

            <h3 className="mb-2 font-['Big_Shoulders_Display'] text-xl font-black uppercase">
              Challenges
            </h3>

            <p className="text-white/65">
              Monthly events and community goals.
            </p>

          </div>

        </div>

      </Container>
    </BackgroundSection>
  );
}
