import LeadCapture from "./LeadCapture";
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

      <Container>

        <div className="relative z-10">

          <div
            className="
              flex
              items-center
              justify-between
              py-5
            "
          >
            <div
              className="
                flex
                items-center
                gap-3
              "
            >
              <img
                src="/images/iron_acre_logo_transparent.png"
                alt="Iron Acre Gym"
                className="
                  h-10
                  w-10
                  object-contain
                "
              />

              <span
                className="
                  font-['Big_Shoulders_Display']
                  text-2xl
                  font-black
                  uppercase
                "
              >
                Iron Acre Gym
              </span>
            </div>

            <a
              href="#start"
              className="
                hidden
                md:inline-flex
                rounded-md
                bg-[#cc5500]
                px-4
                py-2
                text-sm
                font-semibold
              "
            >
              Start Free
            </a>
          </div>

          <div
            className="
              grid
              min-h-[calc(100vh-100px)]
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
                Westerfield, Ipswich
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
              <LeadCapture />
            </div>

          </div>

        </div>

      </Container>

    </section>
  );
}
