import { BackgroundSection } from "./ui/background-section";

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
      <div className="mx-auto max-w-6xl px-6">

        <div className="max-w-4xl">

          <div className="mb-4 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
            COMMUNITY
          </div>

          <h2
            className="
              mb-6
              font-['Big_Shoulders_Display']
              text-[clamp(4rem,10vw,7rem)]
              font-black
              uppercase
              leading-[0.85]
            "
          >
            Nobody Trains
            <br />
            Alone.
          </h2>

          <p className="max-w-3xl text-xl text-white/90">
            The reason most people fail isn't a lack of effort.
            It's trying to do everything alone.
          </p>

          <p className="mt-6 max-w-3xl text-lg text-white/70">
            Iron Acre is built around accountability,
            support and showing up consistently.
            Whether you're lifting for the first time
            or you've trained for years, there is
            always somebody in your corner.
          </p>

        </div>

        <div className="mt-20 grid gap-10 md:grid-cols-3">

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
              Daily
              Check-ins
            </h3>

            <p className="text-white/80">
              Stay accountable. Share your wins,
              ask questions and keep momentum
              moving forward.
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
              Coach
              Access
            </h3>

            <p className="text-white/80">
              Direct support from a real coach
              whenever you need guidance.
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
              Events &
              Challenges
            </h3>

            <p className="text-white/80">
              Monthly challenges, community events
              and opportunities to train together.
            </p>

          </div>

        </div>

      </div>
    </BackgroundSection>
  );
}
