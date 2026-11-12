import { Button } from "./ui/button";
import { Container } from "./ui/container";

export default function Location() {
  return (
    <section
      id="location"
      className="bg-[#1b231c] py-16"
    >
      <Container>

        <div className="mb-10">

          <div className="mb-3 uppercase tracking-[0.15em] text-[#cc5500] text-sm font-bold">
            FIND US
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
            Westerfield, Ipswich
          </h2>

          <p className="max-w-2xl text-base text-white/65">
            Train outdoors overlooking the meadow,
            surrounded by farmland and open space.
          </p>

        </div>

        <div className="grid gap-8 lg:grid-cols-2">

          <div className="overflow-hidden rounded-lg border border-white/10">

            <iframe
              src="https://www.google.com/maps?q=Iron%20Acre%20Gym&output=embed"
              className="h-[350px] w-full"
              loading="lazy"
            />

          </div>

          <div>

            <div className="space-y-6">

              <div>

                <h3
                  className="
                    mb-2
                    font-['Big_Shoulders_Display']
                    text-2xl
                    font-black
                    uppercase
                  "
                >
                  Classes
                </h3>

                <p className="text-white/65">
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
                    text-2xl
                    font-black
                    uppercase
                  "
                >
                  Location
                </h3>

                <p className="text-white/65">
                  Iron Acre Gym
                  <br />
                  Westerfield
                  <br />
                  Ipswich
                </p>

              </div>

              <Button
                className="
                  h-11
                  bg-[#cc5500]
                  hover:bg-[#db6712]
                "
              >
                Get Directions
              </Button>

            </div>

          </div>

        </div>

      </Container>

    </section>
  );
}
