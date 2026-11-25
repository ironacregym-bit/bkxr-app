import LeadCapture from "../components/LeadCapture";
import Seo from "../components/Seo";
import SiteHeader from "../components/SiteHeader";
import { getCanonicalUrl } from "../lib/site-url";
import Image from "next/image";

const winterArcSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SportsActivityLocation",
      "@id": getCanonicalUrl("/") || undefined,
      name: "Iron Acre Gym",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Westerfield, Ipswich",
        addressRegion: "Suffolk",
        addressCountry: "GB",
      },
    },
    {
      "@type": "Service",
      name: "Winter Arc 2027",
      serviceType: "Strength and conditioning coaching",
      provider: {
        "@type": "SportsActivityLocation",
        name: "Iron Acre Gym",
      },
      areaServed: "Ipswich, Suffolk",
      description:
        "A coached training programme with two workouts each week, online coaching and an online workout plan.",
      offers: {
        "@type": "Offer",
        price: "100",
        priceCurrency: "GBP",
        description: "£100 per month",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "When does Winter Arc 2027 start?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Winter Arc is planned to start in the second week of January 2027. Exact session dates and times will be shared before booking.",
          },
        },
        {
          "@type": "Question",
          name: "How much does Winter Arc cost?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The programme costs £100 per month.",
          },
        },
        {
          "@type": "Question",
          name: "What is included?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The programme includes two workouts each week, an online coach and an online workout plan.",
          },
        },
        {
          "@type": "Question",
          name: "Does the form book or charge me?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. The form registers your interest only. Iron Acre Gym will contact you with details before any booking or payment.",
          },
        },
      ],
    },
  ],
};

export default function WinterArcPage() {
  return (
    <>
      <Seo
        title="Winter Arc 2027 in Ipswich | Iron Acre Gym"
        description="Build strength this winter with Iron Acre Gym's Winter Arc 2027 in Westerfield, Ipswich. Two workouts each week, online coaching and an online workout plan for £100 per month."
        path="/winter-arc"
        structuredData={winterArcSchema}
      />

      <main className="min-h-screen bg-[#141a15] text-[#e8eae2]">
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0">
            <Image
              src="/images/GymFrontView.jpeg"
              alt=""
              fill
              sizes="100vw"
              priority
              className="object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#141a15]/35 via-[#141a15]/75 to-[#141a15]" />
          </div>

          <SiteHeader
            variant="overlay"
            ctaHref="#register"
            ctaLabel="Register interest"
          />
          <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-14 sm:pb-28">
            <div className="grid items-center gap-12 lg:grid-cols-[1fr_380px]">
              <div>
                <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-[#e98740]">
                  Westerfield · Ipswich · January 2027
                </p>
                <h1 className="mb-6 max-w-3xl font-display text-6xl font-black uppercase leading-[0.85] sm:text-7xl lg:text-8xl">
                  Winter Arc
                  <span className="block text-[#cc5500]">2027</span>
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-white/75 sm:text-xl">
                  Make winter the start of your strongest year. Train with
                  Iron Acre Gym in Westerfield, Ipswich, with two workouts
                  each week, an online coach and an online workout plan.
                </p>

                <div className="mt-8 flex flex-wrap items-end gap-x-3 gap-y-1">
                  <span className="font-display text-5xl font-black text-white">
                    £100
                  </span>
                  <span className="pb-2 text-white/65">per month</span>
                  <span className="w-full text-sm text-white/50">
                    Planned start: second week of January 2027
                  </span>
                </div>

                <a
                  href="#register"
                  className="mt-8 inline-flex rounded-md bg-[#cc5500] px-6 py-3 font-bold text-white transition hover:bg-[#db6712]"
                >
                  Get Winter Arc details
                </a>
              </div>

              <div id="register" className="scroll-mt-8">
                <LeadCapture
                  source="winter-arc-2027"
                  heading="Get early details"
                  description="Leave your name and email to hear about Winter Arc 2027. This is an expression of interest, not a booking."
                  buttonLabel="Register my interest"
                  successHeading="Interest registered"
                  successMessage="Your Winter Arc 2027 interest is saved. We'll be in touch with programme details."
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="mb-10 max-w-3xl">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-[#cc5500]">
              The programme
            </p>
            <h2 className="mb-4 font-display text-4xl font-black uppercase leading-none sm:text-5xl">
              A plan you can keep showing up for
            </h2>
            <p className="text-white/65">
              Winter Arc combines coached training at Iron Acre Gym with
              practical online support, so you have structure between sessions
              as well as when you train with us.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                number: "01",
                title: "Two workouts every week",
                description:
                  "Build a consistent training rhythm with two workouts each week.",
              },
              {
                number: "02",
                title: "An online coach",
                description:
                  "Get online coaching support to help you stay focused and accountable.",
              },
              {
                number: "03",
                title: "Your online workout plan",
                description:
                  "Follow an online workout plan that gives your training direction between sessions.",
              },
            ].map((item) => (
              <article
                key={item.number}
                className="rounded-lg border border-white/10 bg-[#1b231c] p-6"
              >
                <p className="mb-5 font-display text-3xl font-black text-[#cc5500]">
                  {item.number}
                </p>
                <h3 className="mb-3 font-display text-2xl font-black uppercase">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-white/60">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#1b231c]">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1fr_320px] md:items-center">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-[#cc5500]">
                Train with Iron Acre
              </p>
              <h2 className="mb-4 font-display text-4xl font-black uppercase leading-none sm:text-5xl">
                Outdoor strength training in Ipswich
              </h2>
              <p className="max-w-2xl leading-relaxed text-white/65">
                Iron Acre Gym is based in Westerfield, Ipswich. Sessions are
                coached and can be adapted to different experience and fitness
                levels. Register your interest and we&apos;ll share the
                confirmed Winter Arc schedule before bookings open.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#141a15] p-6">
              <p className="mb-2 text-sm uppercase tracking-wider text-white/50">
                Winter Arc 2027
              </p>
              <p className="font-display text-4xl font-black">£100/month</p>
              <p className="mt-2 text-sm text-white/60">
                Planned start in the second week of January 2027.
              </p>
              <a
                href="#register"
                className="mt-6 inline-flex w-full justify-center rounded-md bg-[#cc5500] px-5 py-3 font-bold text-white transition hover:bg-[#db6712]"
              >
                Register interest
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-[#cc5500]">
            Common questions
          </p>
          <h2 className="mb-8 font-display text-4xl font-black uppercase leading-none sm:text-5xl">
            Winter Arc FAQ
          </h2>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {[
              {
                question: "When does Winter Arc 2027 start?",
                answer:
                  "The programme is planned to start in the second week of January 2027. Exact session dates and times will be shared before booking.",
              },
              {
                question: "How much does Winter Arc cost?",
                answer: "Winter Arc is £100 per month.",
              },
              {
                question: "What is included in the programme?",
                answer:
                  "The programme includes two workouts each week, an online coach and an online workout plan.",
              },
              {
                question: "Does registering my interest book a place?",
                answer:
                  "No. This form only lets Iron Acre Gym know you would like more information. It does not book a place or take payment.",
              },
            ].map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="cursor-pointer list-none pr-6 font-display text-xl font-black uppercase marker:content-none">
                  {item.question}
                </summary>
                <p className="mt-3 max-w-3xl leading-relaxed text-white/65">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <footer className="border-t border-white/10 bg-[#0f1812]">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-display text-2xl font-black uppercase text-white">
              Iron Acre Gym
            </span>
            <span>Westerfield, Ipswich, Suffolk</span>
            <a className="text-white hover:text-[#e98740]" href="/">
              Visit Iron Acre Gym
            </a>
          </div>
        </footer>
      </main>
    </>
  );
}
