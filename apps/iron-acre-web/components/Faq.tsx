import { AccordionItem } from "./ui/accordion";
import { Container } from "./ui/container";

export default function Faq() {
  return (
    <section className="bg-[#1b231c] py-16">

      <Container>

        <div className="mb-10">

          <div className="mb-3 uppercase tracking-[0.15em] text-[#cc5500] text-sm font-bold">
            FAQ
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
            Quick Answers
          </h2>

          <p className="max-w-2xl text-base text-white/65">
            Everything you need to know before your first session.
          </p>

        </div>

        <div className="border-t border-white/10">

          <AccordionItem title="What is a class like?">
            Farm Strength & Conditioning is a coached outdoor session
            using sandbags, kettlebells, sleds, yokes and conditioning equipment.
          </AccordionItem>

          <AccordionItem title="Can beginners join?">
            Absolutely. Every exercise scales to your current fitness level.
          </AccordionItem>

          <AccordionItem title="When are classes?">
            Monday and Wednesday from 6:30pm to 7:30pm.
          </AccordionItem>

          <AccordionItem title="How much is it?">
            £10 per class.
          </AccordionItem>

          <AccordionItem title="What should I bring?">
            Comfortable clothing, water and suitable footwear.
          </AccordionItem>

          <AccordionItem title="Do I need gym experience?">
            No. We coach complete beginners as well as experienced lifters.
          </AccordionItem>

        </div>

      </Container>

    </section>
  );
}
