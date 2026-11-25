// components/train/TrainWeekCardGrid.tsx
import TrainWeekCard from "./TrainWeekCard";

type TrainWeekGridCard = {
  dateKey: string;
  title: string;
  extraCount: number;
  done: boolean;
  href: string;
  dayLabel: string;
  isToday?: boolean;
};

export default function TrainWeekCardGrid({
  cards,
}: {
  cards: TrainWeekGridCard[];
}) {
  if (!cards.length) {
    return <div className="text-dim small mt-3">No workouts scheduled this week yet.</div>;
  }

  return (
    <div className="row g-2 mt-3">
      {cards.map((card) => (
        <div key={card.dateKey} className="col-6">
          <TrainWeekCard
            href={card.href}
            dayLabel={card.dayLabel}
            title={card.title}
            extraCount={card.extraCount}
            done={card.done}
            isToday={Boolean(card.isToday)}
          />
        </div>
      ))}
    </div>
  );
}
