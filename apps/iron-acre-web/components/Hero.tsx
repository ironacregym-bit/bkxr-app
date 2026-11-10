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
          max-w-[1180px]
          px-5
        "
      >
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
              whitespace-nowrap
            "
          >
            <img
              src="/images/iron_acre_logo_transparent.png"
              alt="Iron Acre Gym"
              className="
                h-12
                w-12
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
            min-h-[calc(100vh-110px)]
            items-center
            gap-12
            lg:grid-cols-[650px_380px]
            lg:justify-center
          "
        >
          <div>
            <div
              className="
                mb-5
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
                text-[clamp(4.5rem,12vw,8rem)]
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
                max-w-lg
                text-xl
                leading-relaxed
                text-white/90
              "
            >
              An outdoor gym in Westerfield,
              Ipswich, overlooking an open meadow.
              Sandbags, kettlebells, yokes and sleds,
              coached for everyday people.
              Start free: 7 days of training plus
              a free class.
            </p>
          </div>

          <div
            id="start"
            className="w-full max-w-[380px]"
          >
            <LeadCapture />
          </div>
        </div>

      </div>
    </section>
  );
}
