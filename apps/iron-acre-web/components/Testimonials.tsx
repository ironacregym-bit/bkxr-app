import { Card } from "./ui/card";
import { Container } from "./ui/container";

const testimonials = [
  {
    name: "Chris",
    quote:
      "Awesome farm setting gym. Totally different experience from a commercial gym.",
  },
  {
    name: "Elaine",
    quote:
      "Felt comfortable as soon as I came and never felt out of place.",
  },
  {
    name: "Ross",
    quote:
      "Got me lifting heavy again and enjoying training for the first time in years.",
  },
  {
    name: "Iron Acre Member",
    quote:
      "Helped me rebuild strength and confidence after injury.",
  },
];

export default function Testimonials() {
  return (
    <section className="bg-[#141a15] py-16">

      <Container>

        <div className="mb-10">

          <div className="mb-3 uppercase tracking-[0.15em] text-[#cc5500] text-sm font-bold">
            TESTIMONIALS
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
            What Members Say
          </h2>

        </div>

        <div className="grid gap-4 md:grid-cols-2">

          {testimonials.map((item) => (
            <Card
              key={item.name}
              className="
                border-white/10
                bg-[#1b231c]
                p-5
              "
            >
              <p className="mb-4 text-base text-white/80">
                "{item.quote}"
              </p>

              <div className="text-sm uppercase tracking-wide text-[#cc5500]">
                {item.name}
              </div>

            </Card>
          ))}

        </div>

      </Container>

    </section>
  );
}
