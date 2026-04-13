// components/gym-create/RoundEditor.tsx
import SingleExerciseEditor from "./SingleExerciseEditor";
import SupersetEditor from "./SupersetEditor";

export default function RoundEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: any;
  onChange: (v: any) => void;
}) {
  function addSingle() {
    onChange({
      ...value,
      items: [
        ...(value.items || []),
        { type: "Single", order: value.items.length + 1 },
      ],
    });
  }

  return (
    <section>
      <h3>{title}</h3>

      {(value.items || []).map((it: any, idx: number) =>
        it.type === "Single" ? (
          <SingleExerciseEditor
            key={idx}
            value={it}
            onChange={(v) => {
              const items = [...value.items];
              items[idx] = v;
              onChange({ ...value, items });
            }}
          />
        ) : (
          <SupersetEditor key={idx} />
        )
      )}

      <button onClick={addSingle}>+ Single exercise</button>
    </section>
  );
}
