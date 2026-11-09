export default function Faq() {
  const items = [
    {
      question:
        "What is a class like?",
      answer:
        "Farm Strength & Conditioning is an hour of coached outdoor training using sandbags, kettlebells, carries, sleds and conditioning equipment.",
    },
    {
      question:
        "Is this suitable for beginners?",
      answer:
        "Absolutely. Every workout scales to your ability, making it suitable for complete beginners and experienced lifters.",
    },
    {
      question:
        "When are classes?",
      answer:
        "Mondays and Wednesdays from 6:30pm to 7:30pm.",
    },
    {
      question:
        "How much does it cost?",
      answer:
        "Classes are £10 per session.",
    },
    {
      question:
        "Where are you based?",
      answer:
        "Westerfield, Ipswich.",
    },
  ];

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

        <div className="space-y-4">

          {items.map((item) => (
            <details
              key={item.question}
              className="
                border-b
                border-[#2e3a2f]
                pb-4
              "
            >
              <summary
                className="
                  cursor-pointer
                  font-semibold
                  text-white
                "
              >
                {item.question}
              </summary>

              <p className="mt-3 text-[#a3ad9f]">
                {item.answer}
              </p>

            </details>
          ))}

        </div>

      </div>

    </section>
  );
}
