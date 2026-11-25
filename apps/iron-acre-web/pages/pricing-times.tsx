import Link from "next/link";
import MarketingPage from "../components/MarketingPage";
import { Container } from "../components/ui/container";
import { localServiceSchema } from "../lib/seo-schema";

const pricingFaqs = [
  {
    question: "Is there a free first class?",
    answer: "Yes. Your first group class at Iron Acre is free.",
  },
  {
    question: "How much is a group class?",
    answer: "Group training and boxing drop-ins are £10 per class.",
  },
  {
    question: "Where do sessions take place?",
    answer: "Sessions take place at Iron Acre in Westerfield, Ipswich, Suffolk.",
  },
];

const pricingSchema = localServiceSchema({
  serviceName: "Iron Acre Group Fitness Classes",
  serviceType: "Outdoor group fitness classes",
  description:
    "Outdoor strength, conditioning and boxing classes in Westerfield, Ipswich. First group class is free; drop-in classes are £10.",
  price: 10,
  faqs: pricingFaqs,
});

export default function PricingTimesPage() {
  return (
    <MarketingPage
      title="Gym Prices and Class Times | Iron Acre Gym, Ipswich"
      description="See Iron Acre Gym's outdoor training timetable and prices in Westerfield, Ipswich: Monday and Wednesday strength classes, Wednesday boxing, £10 drop-in and a free first class."
      path="/pricing-times"
      eyebrow="Clear pricing · Westerfield, Ipswich"
      heading="Prices and class times"
      intro="Plan your week with Iron Acre's current outdoor training timetable. Your first group class is free; drop-in sessions are £10."
      structuredData={pricingSchema}
    >
      <section className="py-14 sm:py-20">
        <Container>
          <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-[#e98740]">
                Weekly timetable
              </p>
              <h2 className="font-['Big_Shoulders_Display'] text-4xl font-black uppercase sm:text-5xl">
                Train in Westerfield
              </h2>
            </div>
            <p className="max-w-lg text-sm leading-relaxed text-white/55">
              Boxing starts at 7:30pm on Wednesday. Its finish time is not
              listed, so please check the session details before travelling.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead className="bg-[#1b231c] text-sm uppercase tracking-wide text-white/60">
                <tr>
                  <th scope="col" className="px-5 py-4 font-bold">Day</th>
                  <th scope="col" className="px-5 py-4 font-bold">Time</th>
                  <th scope="col" className="px-5 py-4 font-bold">Session</th>
                  <th scope="col" className="px-5 py-4 font-bold">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                <tr>
                  <th scope="row" className="px-5 py-5 font-bold">Monday</th>
                  <td className="px-5 py-5 text-white/70">6:30–7:30pm</td>
                  <td className="px-5 py-5 text-white/70">
                    Outdoor functional strength and conditioning
                  </td>
                  <td className="px-5 py-5 text-white/70">£10 drop-in</td>
                </tr>
                <tr>
                  <th scope="row" className="px-5 py-5 font-bold">Wednesday</th>
                  <td className="px-5 py-5 text-white/70">6:30–7:30pm</td>
                  <td className="px-5 py-5 text-white/70">
                    Outdoor functional strength and conditioning
                  </td>
                  <td className="px-5 py-5 text-white/70">£10 drop-in</td>
                </tr>
                <tr>
                  <th scope="row" className="px-5 py-5 font-bold">Wednesday</th>
                  <td className="px-5 py-5 text-white/70">7:30pm start</td>
                  <td className="px-5 py-5 text-white/70">Boxing</td>
                  <td className="px-5 py-5 text-white/70">£10 drop-in</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-5 text-sm text-white/55">
            Your first group class is free. Please confirm current availability
            and session details before travelling.
          </p>
        </Container>
      </section>

      <section className="border-y border-white/10 bg-[#1b231c] py-14">
        <Container>
          <div className="grid gap-6 md:grid-cols-2">
            <article className="rounded-lg border border-white/10 bg-[#141a15] p-6">
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#e98740]">
                Group classes
              </p>
              <h2 className="mt-3 font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
                £10 per drop-in
              </h2>
              <p className="mt-3 leading-relaxed text-white/65">
                Try outdoor functional strength and conditioning or Wednesday
                boxing. Your first group class is free.
              </p>
              <Link
                href="/#start"
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-[#cc5500] px-5 font-bold text-white hover:bg-[#db6712]"
              >
                Request a free first class
              </Link>
            </article>
            <article className="rounded-lg border border-white/10 bg-[#141a15] p-6">
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-[#e98740]">
                Online coaching
              </p>
              <h2 className="mt-3 font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
                £75 per month
              </h2>
              <p className="mt-3 leading-relaxed text-white/65">
                Founding-member coaching includes training and nutrition
                guidance, app and community access, and weekly check-ins.
                Limited to 20 places.
              </p>
              <Link
                href="/online-coaching"
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md border border-white/20 px-5 font-bold text-white hover:bg-white/5"
              >
                Explore online coaching
              </Link>
            </article>
          </div>
        </Container>
      </section>

      <section className="py-14">
        <Container>
          <h2 className="mb-8 font-['Big_Shoulders_Display'] text-4xl font-black uppercase">
            Pricing questions
          </h2>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {pricingFaqs.map(({ question, answer }) => (
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
