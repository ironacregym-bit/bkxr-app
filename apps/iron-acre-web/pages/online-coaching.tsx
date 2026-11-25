import Link from "next/link";
import MarketingPage from "../components/MarketingPage";
import { Container } from "../components/ui/container";
import { localServiceSchema } from "../lib/seo-schema";

const coachingFaqs = [
  {
    question: "How much does online coaching cost?",
    answer:
      "The advertised founding-member rate is £75 per month, with 20 coaching places.",
  },
  {
    question: "What does coaching include?",
    answer:
      "The current offer includes training adapted to your equipment and goals, weekly strength and cardio sessions, calorie and macro guidance, Iron Acre app access, community access and weekly coach check-ins.",
  },
];

const coachingSchema = localServiceSchema({
  serviceName: "Iron Acre Online Coaching",
  serviceType: "Online fitness coaching",
  description:
    "Online fitness coaching with personalised training, nutrition guidance, app and community access, and weekly coach check-ins.",
  price: 75,
  priceUnit: "per month",
  faqs: coachingFaqs,
});

export default function OnlineCoachingPage() {
  return (
    <MarketingPage
      title="Online Fitness Coaching | Iron Acre Gym, Ipswich"
      description="Online coaching from Iron Acre Gym: personalised training, nutrition guidance, app and community access, with weekly coach check-ins. Founding rate £75/month."
      path="/online-coaching"
      eyebrow="Online coaching · 20 places"
      heading="A plan built around your life"
      intro="Get training and nutrition support shaped around your goals and the equipment you have—with regular check-ins to keep you moving forward."
      structuredData={coachingSchema}
    >
      <section className="py-14 sm:py-20">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-[#e98740]">
                Personal support, wherever you train
              </p>
              <h2 className="mb-5 font-['Big_Shoulders_Display'] text-4xl font-black uppercase sm:text-5xl">
                Coaching that works with your kit and your week
              </h2>
              <p className="max-w-2xl leading-relaxed text-white/70">
                Build consistency with training adapted to your goals and
                available equipment. The current coaching offer includes
                weekly strength and cardio sessions, nutrition guidance, app
                and community access, and a weekly coach check-in.
              </p>
              <p className="mt-4 max-w-2xl leading-relaxed text-white/70">
                Coaching is capped at 20 members so the service can stay
                personal. Apply through the Iron Acre site and the team can
                confirm availability and the current offer.
              </p>
              <Link
                href="/#coaching"
                className="mt-7 inline-flex min-h-11 items-center justify-center rounded-md bg-[#cc5500] px-5 font-bold text-white hover:bg-[#db6712]"
              >
                Apply for online coaching
              </Link>
            </div>

            <aside className="rounded-lg border border-[#cc5500]/50 bg-[#1b231c] p-6">
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#e98740]">
                Founding-member offer
              </p>
              <p className="mt-3 font-['Big_Shoulders_Display'] text-6xl font-black">
                £75
                <span className="ml-2 text-xl font-bold text-white/60">
                  / month
                </span>
              </p>
              <p className="mt-2 text-white/55">Limited to 20 places</p>
              <ul className="mt-6 space-y-3 text-sm leading-relaxed text-white/75">
                <li>Training tailored to your goals and equipment</li>
                <li>2–3 strength sessions and 1–2 cardio sessions weekly</li>
                <li>Calories and macros worked out for you</li>
                <li>Iron Acre app and community access</li>
                <li>Weekly coach check-ins</li>
              </ul>
              <Link
                href="/#coaching"
                className="mt-7 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-white/20 px-5 font-bold text-white hover:bg-white/5"
              >
                See the application form
              </Link>
            </aside>
          </div>
        </Container>
      </section>

      <section className="border-y border-white/10 bg-[#1b231c] py-14">
        <Container>
          <h2 className="mb-8 font-['Big_Shoulders_Display'] text-4xl font-black uppercase">
            Online coaching FAQs
          </h2>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {coachingFaqs.map(({ question, answer }) => (
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
