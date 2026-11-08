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
      <div
        className="
          absolute
          inset-0
          bg-cover
          bg-center
          opacity-40
        "
        style={{
          backgroundImage:
            "url('/images/hero.jpg')",
        }}
      />

      <div
        className="
          absolute
          inset-0
          bg-gradient-to-b
          from-black/40
          via-black/30
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
            py-8
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
                h-14
                w-14
                object-contain
              "
            />

            <span
              className="
                font-['Big_Shoulders_Display']
                text-3xl
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
              rounded-md
              bg-[#cc5500]
              px-5
              py-3
              font-semibold
              text-white
              transition
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
            lg:grid-cols-[1.2fr_0.8fr]
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
              An outdoor gym in Westerfield,
              Ipswich, overlooking an open
              meadow. Sandbags, kettlebells,
              yokes and sleds, coached for
              everyday people.
            </p>
          </div>

          <div id="start">
            <LeadCapture />
          </div>
        </div>
      </div>
    </section>
  );
}
