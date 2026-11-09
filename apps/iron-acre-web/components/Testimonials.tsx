import { Card } from "./ui/card";

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
    <section className="py-24 bg-[#141a15]">

      <div className="mx-auto max-w-7xl px-6">

        <div className="max-w-3xl mb-12">

          <div className="mb-4 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
            TESTIMONIALS
          </div>

          <h2
            className="
              mb-6
              font-['Big_Shoulders_Display']
              text-[clamp(3rem,8vw,5rem)]
              font-black
              uppercase
              leading-none
            "
          >
            Members
            Stick Around
          </h2>

          <p className="text-xl text-white/90">
            Real people. Real results.
          </p>

        </div>

        <div className="grid gap-6 md:grid-cols-2">

          {testimonials.map((item) => (
            <Card
              key={item.name}
              className="
                border-[#2e3a2f]
                bg-[#1b231c]
              "
            >
              <div className="text-5xl text-[#cc5500] leading-none">
                "
              </div>

              <p className="mt-4 text-lg text-white/90">
                {item.quote}
              </p>

              <div className="mt-6 font-semibold text-[#cc5500]">
                {item.name}
              </div>

            </Card>
          ))}

        </div>

      </div>

    </section>
  );
}
