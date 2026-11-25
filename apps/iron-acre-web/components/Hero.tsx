import LeadCapture from "./LeadCapture";
import SiteHeader from "./SiteHeader";
import { Container } from "./ui/container";

export default function Hero() {
  return (
    <section
      className="
        relative
        min-h-screen
        overflow-hidden
        bg-[#141a15]
        text-white
      "
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="/images/GymFrontView.jpeg"
        className="
          absolute
          inset-0
          h-full
          w-full
          object-cover
          opacity-40
        "
      >
        <source
          src="/video/HeroVideo.mp4"
          type="video/mp4"
        />
      </video>

      <div
        className="
          absolute
          inset-0
          bg-gradient-to-b
          from-black/60
          via-black/40
          to-[#141a15]
        "
      />

      <SiteHeader variant="overlay" />

      <Container>
        <div className="relative z-10">
          <div
            className="
              grid
              min-h-[calc(100vh-76px)]
              items-center
              gap-10
              lg:grid-cols-[1fr_340px]
            "
          >
            <div>

              <div
                className="
                  mb-4
                  uppercase
                  tracking-[0.15em]
                  text-[#cc5500]
                  text-sm
                  font-bold
                "
              >
                Outdoor gym · Westerfield, Ipswich
              </div>

              <h1
                className="
                  mb-5
                  font-['Big_Shoulders_Display']
                  text-[clamp(3.5rem,10vw,6rem)]
                  font-black
                  uppercase
                  leading-[0.85]
                "
              >
                GET FARM
                <br />
                STRONG.
              </h1>

              <p
                className="
                  max-w-xl
                  text-base
                  text-white/80
                "
              >
                Outdoor strength and conditioning
                overlooking the meadow. Sandbags,
                kettlebells, yokes and sleds,
                coached for everyday people.
              </p>

            </div>

            <div
              id="start"
              className="w-full"
            >
              <LeadCapture
                successHref="/7-day-workout"
                successLinkLabel="View your 7-day workout"
              />
            </div>

          </div>

        </div>
      </Container>

    </section>
  );
}
