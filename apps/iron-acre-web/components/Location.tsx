import { Button } from "./ui/button";

export default function Location() {
  return (
    <section
      id="location"
      className="bg-[#1b231c] py-24"
    >
      <div className="mx-auto max-w-6xl px-6">

        <div className="mb-16">

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
              leading-[0.85]
            "
          >
            Westerfield.
            <br />
            Ipswich.
          </h2>

          <p className="max-w-3xl text-xl text-white/70">
            Train outdoors overlooking the meadow,
            surrounded by farmland and open space.
          </p>

        </div>

        <div className="grid gap-12 lg:grid-cols-2">

          <div className="overflow-hidden rounded-lg border border-white/10">

            <iframe
              src="https://www.google.com/maps?q=Westerfield%20Ipswich&output=embed"
              className="h-[450px] w-full"
              loading="lazy"
            />

          </div>

          <div>

            <div className="space-y-8">

              <div>

                <h3
                  className="
                    mb-2
                    font-['Big_Shoulders_Display']
                    text-4xl
                    font-black
                    uppercase
                  "
                >
                  Classes
                </h3>

                <p className="text-white/70">
                  Monday & Wednesday
                  <br />
                  6:30pm to 7:30pm
                </p>

              </div>

              <div>

                <h3
                  className="
                    mb-2
                    font-['Big_Shoulders_Display']
                    text-4xl
                    font-black
                    uppercase
                  "
                >
                  Location
                </h3>

                <p className="text-white/70">
                  Westerfield
                  <br />
                  Ipswich
                </p>

              </div>

              <div>

                <h3
                  className="
                    mb-2
                    font-['Big_Shoulders_Display']
                    text-4xl
                    font-black
                    uppercase
                  "
                >
                  Contact
                </h3>

                <p className="text-white/70">
                  Claim your free class and
                  we'll get in touch.
                </p>

              </div>

              <Button
                className="
                  h-14
                  bg-[#cc5500]
                  px-8
                  hover:bg-[#db6712]
                "
              >
                Get Directions
              </Button>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
