import { AccordionItem } from "./ui/accordion";

export default function Faq() {
  return (
    <section className="bg-[#1b231c] py-24">

      <div className="mx-auto max-w-5xl px-6">

        <div className="mb-12">

          <div className="mb-4 uppercase tracking-[0.15em] text-[#cc5500] font-bold">
            FAQ
          </div>

          <h2
            className="
              font-['Big_Shoulders_Display']
              text-[clamp(3rem,8vw,5rem)]
              font-black
              uppercase
              leading-none
            "
          >
            Quick Answers
          </h2>

        </div>

        <AccordionItem
          title="What is a class like?"
        >
          Farm Strength &
          Conditioning is an hour
          of coached outdoor
          training using sandbags,
          sleds, kettlebells and
          conditioning equipment.
        </AccordionItem>

        <AccordionItem
          title="Can beginners join?"
        >
          Absolutely. Every
          exercise scales to your
          current fitness and
          experience level.
        </AccordionItem>

        <AccordionItem
          title="When are classes?"
        >
          Monday and Wednesday
          evenings from 6:30pm to
          7:30pm.
        </AccordionItem>

        <AccordionItem
          title="How much is it?"
        >
          £10 per class.
        </AccordionItem>

      </div>

    </section>
  );
}
