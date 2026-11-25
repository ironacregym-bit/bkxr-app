import Link from "next/link";
import MarketingPage from "../components/MarketingPage";
import { Container } from "../components/ui/container";
import { localServiceSchema } from "../lib/seo-schema";

const boxingFaqs = [
  {
    question: "When is the boxing session?",
    answer: "Wednesday at 7:30pm in Westerfield, Ipswich.",
  },
  {
    question: "How much is a boxing drop-in?",
    answer: "Boxing drop-in is £10. Your first group class is free.",
  },
  {
    question: "What should I bring?",
    answer:
      "Please contact Iron Acre before attending to confirm the session format and any equipment to bring.",
  },
];

const boxingSchema = localServiceSchema({
  serviceName: "Wednesday Boxing Training",
  serviceType: "Boxing fitness session",
  description:
    "A weekly Wednesday boxing session starting at 7:30pm at Iron Acre Gym in Westerfield, Ipswich.",
  price: 10,
  faqs: boxingFaqs,
});

export default function BoxingPage() {
  return (
    <MarketingPage
      title="Boxing Training in Ipswich | Wednesday at 7:30pm | Iron Acre"
      description="Join Wednesday boxing training at Iron Acre Gym in Westerfield, Ipswich. The session starts at 7:30pm; drop-in is £10 and your first group class is free."
      path="/boxing"
      eyebrow="Wednesday · 7:30pm start"
      heading="Boxing training in Ipswich"
      intro="Add a weekly boxing session to your training routine at Iron Acre Gym in Westerfield. Find the start time and simple drop-in pricing, then check in with the team before your first visit."
      image="/images/Gym_side_view.JPG"
      structuredData={boxingSchema}
    >
      <section className="py-14 sm:py-20">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-[#e98740]">
                Boxing at Iron Acre
              </p>
              <h2 className="mb-5 font-['Big_Shoulders_Display'] text-4xl font-black uppercase sm:text-5xl">
                A weekly session to get in the diary
              </h2>
              <p className="max-w-2xl leading-relaxed text-white/70">
                The boxing session runs on Wednesday evening and starts at
                7:30pm. If you are new to Iron Acre, get in touch before you
                travel so we can confirm the current session format, equipment
                requirements and suitability for your experience.
              </p>
              <p className="mt-4 max-w-2xl leading-relaxed text-white/70">
                Iron Acre also runs outdoor functional strength and conditioning
                on Monday and Wednesday from 6:30pm to 7:30pm.
              </p>
              <Link
                href="/#start"
                className="mt-7 inline-flex min-h-11 items-center justify-center rounded-md bg-[#cc5500] px-5 font-bold text-white hover:bg-[#db6712]"
              >
                Ask about your first class
              </Link>
            </div>

            <div className="rounded-lg border border-[#cc5500]/50 bg-[#1b231c] p-6">
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#e98740]">
                Session details
              </p>
              <dl className="mt-4 divide-y divide-white/10">
                <div className="py-4">
                  <dt className="font-bold">Day and start time</dt>
                  <dd className="mt-1 text-white/65">Wednesday, 7:30pm</dd>
                </div>
                <div className="py-4">
                  <dt className="font-bold">Drop-in price</dt>
                  <dd className="mt-1 text-white/65">£10</dd>
                </div>
                <div className="py-4">
                  <dt className="font-bold">First class</dt>
                  <dd className="mt-1 text-white/65">
                    Your first group class is free
                  </dd>
                </div>
                <div className="py-4">
                  <dt className="font-bold">Location</dt>
                  <dd className="mt-1 text-white/65">
                    Westerfield, Ipswich, Suffolk
                  </dd>
                </div>
              </dl>
              <p className="text-sm text-white/45">
                Please confirm the current session details before travelling.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-y border-white/10 bg-[#1b231c] py-14">
        <Container>
          <h2 className="mb-8 font-['Big_Shoulders_Display'] text-4xl font-black uppercase">
            Boxing questions
          </h2>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {boxingFaqs.map(({ question, answer }) => (
              <details key={question} className="py-5">
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
