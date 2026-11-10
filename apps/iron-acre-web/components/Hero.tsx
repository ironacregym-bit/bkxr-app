import LeadCapture from "./LeadCapture";

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

      <div
        className="
          relative
          z-10
          mx-auto
          max-w-7xl
          px-6
        "
      >
        <div
          className="
            flex
            items-center
            justify-between
            py-6
          "
        >
          <div
            className="
              flex
              items-center
              gap-4
              whitespace-nowrap
            "
          >
            <img
              src="/images/iron_acre_logo_transparent.png"
              alt="Iron Acre Gym"
              className="
                h-16
                w-16
                object-contain
              "
            />

            <span
              className="
                font-['Big_Shoulders_Display']
                text-[2rem]
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
              px-5
              py-3
              font-semibold
              transition-colors
              hover:bg-[#db6712]
            "
          >
            Start Free
          </a>
        </div>

        <div
          className="
            grid
            min-h-[calc(100vh-120px)]
            items-center
            gap-16
            lg:grid-cols-[1fr_430px]
          "
        >
          <div>
            <div
              className="
                mb-4
                uppercase
                tracking-[0.15em]
                text-[#cc5500]
                font-bold
              "
            >
              Westerfield, Ipswich
            </div>

            <h1
              className="
                mb-6
                font-['Big_Shoulders_Display']
                text-[clamp(5rem,17vw,10rem)]
                font-black
                uppercase
                leading-[0.82]
              "
            >
              GET FARM
              <br />
              STRONG.
            </h1>

            <p
              className="
                max-w-2xl
                text-xl
                font-medium
                text-white/90
              "
            >
              Outdoor strength and conditioning
              overlooking the meadow. Sandbags,
              kettlebells, sleds and yokes,
              coached for everyday people.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">

              <a
                href="#start"
                className="
                  rounded-md
                  bg-[#cc5500]
                  px-6
                  py-3
                  font-semibold
                  transition-colors
                  hover:bg-[#db6712]
                "
              >
                Claim Free Class
              </a>

              <a
                href="#coach"
                className="
                  rounded-md
                  border
                  border-white/20
                  px-6
                  py-3
                  font-semibold
                  backdrop-blur-sm
                "
              >
                Meet Rob
              </a>

            </div>
          </div>

          <div
            id="start"
            className="w-full max-w-[430px]"
          >
            <LeadCapture />
          </div>
        </div>

      </div>
    </section>
  );
}
