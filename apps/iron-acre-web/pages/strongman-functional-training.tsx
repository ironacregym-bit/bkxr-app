import Link from "next/link";
import MarketingPage from "../components/MarketingPage";
import { Container } from "../components/ui/container";
import { localServiceSchema } from "../lib/seo-schema";

const strengthFaqs = [
  {
    question: "Do I need strongman experience?",
    answer:
      "No. Iron Acre's strongman-inspired functional training is scaled to each person's current ability.",
  },
  {
    question: "When are the group strength sessions?",
    answer: "Monday and Wednesday from 6:30pm to 7:30pm.",
  },
  {
    question: "How much does a session cost?",
    answer: "The first group class is free; drop-in classes are £10.",
  },
];

const strengthSchema = localServiceSchema({
  serviceName: "Strongman-Inspired Functional Training",
  serviceType: "Group strength and conditioning classes",
  description:
    "Beginner-friendly coached outdoor strength and conditioning in Westerfield, Ipswich.",
  price: 10,
  faqs: strengthFaqs,
});

export default function StrengthTrainingPage() {
  return (
    <MarketingPage
      title="Functional & Hybrid Fitness Training in Ipswich | Iron Acre Gym"
      description="Build practical strength and conditioning in Ipswich for everyday fitness or general preparation for HYROX- and DEKA-style events. Iron Acre is an independent, unaffiliated gym."
      path="/strongman-functional-training"
      eyebrow="Strongman-inspired · Scaled for everyone"
      heading="Functional strength for everyday people"
      intro="Lift, carry, push and move with purpose. Join coached outdoor strength and conditioning in Westerfield, Ipswich—whether you are new to training or already experienced."
      image="/images/Gym_side_view.JPG"
      structuredData={strengthSchema}
    >
      <section className="py-14 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-[#e98740]">
                What we train
              </p>
              <h2 className="mb-5 font-['Big_Shoulders_Display'] text-4xl font-black uppercase sm:text-5xl">
                Stronger, fitter, more capable
              </h2>
              <p className="leading-relaxed text-white/70">
                Iron Acre sessions combine strength work and conditioning with
                practical equipment: sandbags, kettlebells, yokes, sleds and
                carries. Exercises are coached and can be adapted to your
                experience and ability.
              </p>
              <p className="mt-4 leading-relaxed text-white/70">
                The aim is useful fitness, not a test of who can lift the
                heaviest. Start with manageable loads, learn the movement and
                build at a pace you can sustain.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#1b231c] p-6">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-[#e98740]">
                Weekly sessions
              </p>
              <h2 className="font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
                Monday and Wednesday
              </h2>
              <p className="mt-2 text-2xl font-bold text-white">6:30–7:30pm</p>
              <p className="mt-4 text-white/65">
                Westerfield, Ipswich · £10 per drop-in class · first class free
              </p>
              <Link
                href="/#start"
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-[#cc5500] px-5 font-bold text-white hover:bg-[#db6712]"
              >
                Request your free first class
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-y border-white/10 bg-[#1b231c] py-14">
        <Container>
          <div className="mb-8 max-w-3xl">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-[#e98740]">
              Hybrid fitness
            </p>
            <h2 className="mb-4 font-['Big_Shoulders_Display'] text-4xl font-black uppercase sm:text-5xl">
              Training for hybrid fitness events
            </h2>
            <p className="leading-relaxed text-white/70">
              Want to improve your general strength and conditioning for a
              hybrid fitness event such as HYROX or DEKA? Our sessions work on
              practical strength, carries and conditioning that can complement
              your own event-specific preparation.
            </p>
          </div>
          <p className="max-w-3xl rounded-lg border border-white/10 bg-[#141a15] p-5 text-sm leading-relaxed text-white/55">
            Iron Acre Gym is independent and is not affiliated with, endorsed
            by, or an official training partner of HYROX or DEKA. Event names
            are used only to describe the type of fitness goal you may be
            preparing for.
          </p>
          <Link
            href="/boxing"
            className="mt-7 inline-flex font-semibold text-[#e98740] underline decoration-white/25 underline-offset-4 hover:text-white"
          >
            See Wednesday boxing training
          </Link>
        </Container>
      </section>

      <section className="py-14">
        <Container>
          <h2 className="mb-8 font-['Big_Shoulders_Display'] text-4xl font-black uppercase">
            Questions before you start
          </h2>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {strengthFaqs.map(({ question, answer }) => (
              <details key={question} className="group py-5">
                <summary className="cursor-pointer list-none pr-6 font-['Big_Shoulders_Display'] text-xl font-black uppercase marker:content-none">
                  {question}
                </summary>
                <p className="mt-3 max-w-3xl leading-relaxed text-white/65">
                  {answer}
                </p>
              </details>
            ))}
          </div>
        </Container>
      </section>
    </MarketingPage>
  );
}
