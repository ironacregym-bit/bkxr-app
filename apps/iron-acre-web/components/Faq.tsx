import { AccordionItem } from "./ui/accordion";

export default function Faq() {
  return (
    <section className="bg-[#1b231c] py-24">
      <div className="mx-auto max-w-6xl px-6">

        <div className="mb-16">

          <div className="mb-4 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
            FAQ
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
            Quick Answers
          </h2>

          <p className="max-w-3xl text-xl text-white/70">
            Everything you need to know before your first session.
          </p>

        </div>

        <div className="border-t border-white/10">

          <AccordionItem title="What is a class like?">
            Farm Strength & Conditioning is a coached one-hour outdoor
            session using sandbags, yokes, sleds, kettlebells, carries
            and conditioning equipment.
          </AccordionItem>

          <AccordionItem title="Can beginners join?">
            Absolutely. Every movement scales to your ability. You do
            not need previous gym experience to get started.
          </AccordionItem>

          <AccordionItem title="When are classes?">
            Classes currently run every Monday and Wednesday from
            6:30pm until 7:30pm.
          </AccordionItem>

          <AccordionItem title="How much is it?">
            Farm Strength & Conditioning classes are £10 per session.
          </AccordionItem>

          <AccordionItem title="What should I bring?">
            Comfortable training clothes, water and suitable footwear.
            We provide all of the equipment.
          </AccordionItem>

          <AccordionItem title="Do I need to be fit first?">
            No. The point is to become fitter. We meet you where you
            are and progress from there.
          </AccordionItem>

          <AccordionItem title="Is the gym indoors or outdoors?">
            The gym is outdoors on a working farm in Westerfield,
            Ipswich. Expect fresh air, open space and a very different
            environment from a commercial gym.
          </AccordionItem>

          <AccordionItem title="How does online coaching work?">
            You'll receive a personalised training plan, coaching
            support, accountability, nutrition guidance and access to
            the Iron Acre community and app.
          </AccordionItem>

        </div>

      </div>
    </section>
  );
}
