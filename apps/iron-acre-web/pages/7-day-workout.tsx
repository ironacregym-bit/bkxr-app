import Link from "next/link";
import MarketingPage from "../components/MarketingPage";
import { Container } from "../components/ui/container";
import { localServiceSchema } from "../lib/seo-schema";

const days = [
  {
    day: "Day 1",
    title: "Build the base",
    focus: "Full-body strength",
    exercises: [
      "Chair sit-to-stand: 2 sets of 8–10",
      "Incline push-up against a sturdy surface: 2 sets of 6–10",
      "Glute bridge: 2 sets of 10",
      "Bird dog: 2 sets of 6 each side",
    ],
  },
  {
    day: "Day 2",
    title: "Get moving",
    focus: "Easy conditioning",
    exercises: [
      "Walk easily for 5 minutes to warm up",
      "Repeat 6 times: 1 minute brisk, 2 minutes easy",
      "Walk easily for 5 minutes to cool down",
      "Keep a pace where you can still speak in short sentences",
    ],
  },
  {
    day: "Day 3",
    title: "Carry it",
    focus: "Carries and core",
    exercises: [
      "Light backpack carry: 3 rounds of 20–30 seconds",
      "Dead bug: 2 sets of 6 each side",
      "Calf raise holding a support: 2 sets of 10",
      "Rest between movements and keep the load comfortable",
    ],
  },
  {
    day: "Day 4",
    title: "Legs and hinge",
    focus: "Lower-body strength",
    exercises: [
      "Hip hinge to a wall: 2 sets of 8",
      "Low step-up holding a support: 2 sets of 6 each side",
      "Chair sit-to-stand: 2 sets of 8",
      "Calf raise: 2 sets of 10",
    ],
  },
  {
    day: "Day 5",
    title: "Push and pull",
    focus: "Upper-body strength",
    exercises: [
      "Incline push-up: 2 sets of 6–10",
      "Light backpack row: 2 sets of 8 each side",
      "Wall slide: 2 sets of 8",
      "Choose a height and load that let you move with control",
    ],
  },
  {
    day: "Day 6",
    title: "The finisher",
    focus: "Short, steady circuit",
    exercises: [
      "Complete 4–6 relaxed rounds",
      "March on the spot for 30 seconds",
      "Do 8 chair sit-to-stands",
      "Rest for 30–60 seconds, or longer if needed",
    ],
  },
  {
    day: "Day 7",
    title: "Get outside",
    focus: "Recovery day",
    exercises: [
      "Rest, or take an easy 20–30 minute walk",
      "Spend 5–10 minutes moving gently through comfortable ranges",
      "Drink water and get ready for your next week",
      "Skip any movement that causes pain",
    ],
  },
];

const workoutSchema = localServiceSchema({
  serviceName: "Free 7-Day Beginner Workout",
  serviceType: "General fitness workout plan",
  description:
    "A free, scalable seven-day starter workout from Iron Acre Gym in Ipswich.",
});

export default function SevenDayWorkoutPage() {
  return (
    <MarketingPage
      title="Free 7-Day Beginner Workout Plan | Iron Acre Gym, Ipswich"
      description="Try Iron Acre Gym's free seven-day beginner workout plan: simple strength, walking, carries, conditioning and recovery sessions you can scale to your level."
      path="/7-day-workout"
      eyebrow="Free starter plan"
      heading="Your 7-day workout"
      intro="Seven simple sessions to help you build a steady routine: strength, conditioning, carries and a proper recovery day. Start at your level and progress at your own pace."
      structuredData={workoutSchema}
    >
      <section className="py-14 sm:py-20">
        <Container>
          <div className="mb-8 rounded-lg border border-[#cc5500]/40 bg-[#1b231c] p-5 text-sm leading-relaxed text-white/75">
            This is a general beginner plan, not an individual coaching
            programme. Use a comfortable range of motion, rest when you need
            to, and stop if something hurts. If you have an injury or health
            concern, check with a qualified health professional before
            starting.
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {days.map((item) => (
              <article
                key={item.day}
                className="rounded-lg border border-white/10 bg-[#1b231c] p-6"
              >
                <p className="mb-2 text-sm font-bold uppercase tracking-[0.15em] text-[#e98740]">
                  {item.day} · {item.focus}
                </p>
                <h2 className="mb-5 font-['Big_Shoulders_Display'] text-3xl font-black uppercase">
                  {item.title}
                </h2>
                <ul className="space-y-3 text-sm leading-relaxed text-white/70">
                  {item.exercises.map((exercise) => (
                    <li key={exercise} className="flex gap-3">
                      <span className="text-[#cc5500]" aria-hidden="true">
                        —
                      </span>
                      <span>{exercise}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-y border-white/10 bg-[#1b231c] py-14">
        <Container>
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-[#e98740]">
                Train with a coach
              </p>
              <h2 className="mb-3 font-['Big_Shoulders_Display'] text-4xl font-black uppercase">
                Want to try an outdoor session?
              </h2>
              <p className="max-w-2xl text-white/65">
                Iron Acre Gym runs coached outdoor strength and functional
                training in Westerfield, Ipswich. Your first group class is
                free.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/#start"
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#cc5500] px-5 font-bold text-white hover:bg-[#db6712]"
              >
                Request a free class
              </Link>
              <Link
                href="/pricing-times"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/20 px-5 font-bold text-white hover:bg-white/5"
              >
                See prices and times
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </MarketingPage>
  );
}
