"use client";

import SingleExerciseEditor, {
  SingleItem,
} from "./SingleExerciseEditor";

export type GymRound = {
  name: string;
  order: number;
  items: SingleItem[];
};

function renumber(items: SingleItem[]): SingleItem[] {
  return items.map((it, i) => ({ ...it, order: i + 1 }));
}

export default function RoundEditor({
  round,
  onChange,
}: {
  round: GymRound;
  onChange: (r: GymRound) => void;
}) {
  function addSingle() {
    const next: SingleItem = {
      uid: crypto.randomUUID(),
      type: "Single",
      order: round.items.length + 1,
      exercise_id: "",
      sets: 3,
      reps: "",
      weight_kg: null,
      rest_s: null,
      strength: null,
    };

    onChange({ ...round, items: renumber([...round.items, next]) });
  }

  function updateItem(idx: number, patch: Partial<SingleItem>) {
    const items = round.items.map((it, i) =>
      i === idx ? { ...it, ...patch } : it
    );
    onChange({ ...round, items });
  }

  function removeItem(idx: number) {
    const items = renumber(round.items.filter((_, i) => i !== idx));
    onChange({ ...round, items });
  }

  return (
    <section className="futuristic-card p-3 mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="m-0">{round.name}</h6>
        <button
          type="button"
          className="btn btn-sm"
          style={{ borderRadius: 24 }}
          onClick={addSingle}
        >
          + Single
        </button>
      </div>

      {round.items.length === 0 ? (
        <div className="small text-dim">No exercises yet.</div>
      ) : (
        round.items.map((it, idx) => (
          <SingleExerciseEditor
            key={it.uid}
            value={it}
            onChange={(patch) => updateItem(idx, patch)}
            onDelete={() => removeItem(idx)}
          />
        ))
      )}
    </section>
  );
}
