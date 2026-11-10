import { Button } from "./ui/button";

export default function Location() {
  return (
    <section
      id="location"
      className="bg-[#d7d9ce] py-24 text-[#0f1812]"
    >
      <div className="mx-auto max-w-6xl px-6">

        <div className="mb-12">

          <div className="mb-4 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
            FIND US
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
            Westerfield
            <br />
            Ipswich
          </h2>

        </div>

        <div className="grid gap-10 lg:grid-cols-2">

          <div>

            <iframe
              src="https://www.google.com/maps?q=Westerfield%20Ipswich&output=embed"
              className="
                h-[450px]
                w-full
                border-0
              "
              loading="lazy"
            />

          </div>

          <div>

            <h3
              className="
                mb-6
                font-['Big_Shoulders_Display']
                text-4xl
                font-black
                uppercase
              "
            >
              Train Outdoors
            </h3>

            <p className="mb-6 text-lg">
              Join us on the farm every
              Monday and Wednesday evening.
            </p>

            <p className="mb-8 text-lg">
              Farm Strength & Conditioning
              runs from 6:30pm to 7:30pm.
            </p>

            <Button>
              Get Directions
            </Button>

          </div>

        </div>

      </div>
    </section>
  );
}
