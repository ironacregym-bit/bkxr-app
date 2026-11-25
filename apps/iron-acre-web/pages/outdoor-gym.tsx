import Link from "next/link";
import MarketingPage from "../components/MarketingPage";
import { Container } from "../components/ui/container";
import { localServiceSchema } from "../lib/seo-schema";

const outdoorGymSchema = localServiceSchema({
  serviceName: "Outdoor Gym and Strength Training",
  serviceType: "Outdoor personal and group fitness training",
  description:
    "Coached outdoor strength and conditioning at Iron Acre Gym in Westerfield, Ipswich.",
  price: 10,
});

export default function OutdoorGymPage() {
  return (
    <MarketingPage
      title="Outdoor Gym in Ipswich | Iron Acre Gym, Westerfield"
      description="Find outdoor gym and coached strength training in Westerfield, Ipswich. Train with kettlebells, sandbags, sleds and carries at Iron Acre Gym."
      path="/outdoor-gym"
      eyebrow="Outdoor training · Westerfield, Ipswich"
      heading="An outdoor gym with room to move"
      intro="Trade the crowded weight room for fresh air, open space and practical strength training. Iron Acre Gym brings coached outdoor sessions to Westerfield, near Ipswich."
      image="/images/GymFrontView.jpeg"
      structuredData={outdoorGymSchema}
    >
      <section className="py-14 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-[#e98740]">
                Train for real life
              </p>
              <h2 className="mb-5 font-['Big_Shoulders_Display'] text-4xl font-black uppercase sm:text-5xl">
                Strength that travels beyond the gym
              </h2>
              <div className="space-y-4 leading-relaxed text-white/70">
                <p>
                  Sessions use practical kit such as kettlebells, sandbags,
                  sleds and loaded carries. Coaches scale the work so people
                  with different starting points can train together.
                </p>
                <p>
                  Iron Acre is an outdoor training space in Westerfield,
                  Ipswich. Wear comfortable clothing and footwear suitable for
                  outdoor conditions, and bring water.
                </p>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/#start"
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#cc5500] px-5 font-bold text-white hover:bg-[#db6712]"
                >
                  Request your free first class
                </Link>
                <Link
                  href="/pricing-times"
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/20 px-5 font-bold text-white hover:bg-white/5"
                >
                  View timetable and prices
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#1b231c] p-6">
              <h2 className="mb-5 font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
                At a glance
              </h2>
              <dl className="divide-y divide-white/10">
                <div className="py-4">
                  <dt className="font-bold text-white">Location</dt>
                  <dd className="mt-1 text-white/65">
                    Westerfield, Ipswich, Suffolk
                  </dd>
                </div>
                <div className="py-4">
                  <dt className="font-bold text-white">Group training</dt>
                  <dd className="mt-1 text-white/65">
                    Monday and Wednesday, 6:30–7:30pm
                  </dd>
                </div>
                <div className="py-4">
                  <dt className="font-bold text-white">First visit</dt>
                  <dd className="mt-1 text-white/65">
                    Your first group class is free
                  </dd>
                </div>
                <div className="py-4">
                  <dt className="font-bold text-white">Drop-in price</dt>
                  <dd className="mt-1 text-white/65">£10 per class</dd>
                </div>
              </dl>
              <a
                href="https://www.google.com/maps/dir/?api=1&destination=Iron+Acre+Gym%2C+Westerfield%2C+Ipswich"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex min-h-11 items-center justify-center rounded-md bg-[#cc5500] px-5 font-bold text-white hover:bg-[#db6712]"
              >
                Get directions
              </a>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-y border-white/10 bg-[#1b231c] py-14">
        <Container>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Coached",
                text: "Get clear guidance and exercise options for your level.",
              },
              {
                title: "Practical",
                text: "Build strength with carries, resistance and conditioning.",
              },
              {
                title: "Outdoors",
                text: "Train in the open air at the Iron Acre site in Westerfield.",
              },
            ].map((item) => (
              <article key={item.title} className="border-t border-[#cc5500] pt-5">
                <h3 className="mb-2 font-['Big_Shoulders_Display'] text-2xl font-black uppercase">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-white/65">
                  {item.text}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </section>
    </MarketingPage>
  );
}
