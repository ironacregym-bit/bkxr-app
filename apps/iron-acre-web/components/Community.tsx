import { BackgroundSection } from "./ui/background-section";

export default function Community() {
  return (
    <BackgroundSection
      image="/images/community.jpg"
    >
      <div className="mx-auto max-w-7xl px-6">

        <div className="max-w-4xl">

          <div className="mb-4 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
            COMMUNITY
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
            Nobody
            Trains Alone
          </h2>

          <p className="max-w-3xl text-xl text-white/90">
            The reason most people fail
            isn't effort.
            It's trying to do everything
            alone.
          </p>

        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">

          <div>
            <h3 className="mb-3 font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
              Daily Check Ins
            </h3>

            <p className="text-white/80">
              Accountability and support
              from people on the same journey.
            </p>
          </div>

          <div>
            <h3 className="mb-3 font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
              Coach Access
            </h3>

            <p className="text-white/80">
              Ask questions and get support
              from a real coach.
            </p>
          </div>

          <div>
            <h3 className="mb-3 font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
              Challenges
            </h3>

            <p className="text-white/80">
              Monthly events and goals
              that keep momentum high.
            </p>
          </div>

        </div>

      </div>
    </BackgroundSection>
  );
}
