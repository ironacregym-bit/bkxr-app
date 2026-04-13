// components/gym-create/SingleExerciseEditor.tsx
import StrengthPrescriptionEditor from "./StrengthPrescriptionEditor";

export default function SingleExerciseEditor({
  value,
  onChange,
}: {
  value: any;
  onChange: (v: any) => void;
}) {
  return (
    <div style={{ border: "1px solid #ccc", padding: 8 }}>
      <input
        placeholder="Exercise name (e.g. Barbell Deadlift)"
        value={value.exercise_id || ""}
        onChange={(e) => onChange({ ...value, exercise_id: e.target.value })}
      />

      <input
        type="number"
        placeholder="Sets"
        value={value.sets || ""}
        onChange={(e) => onChange({ ...value, sets: Number(e.target.value) })}
      />

      <input
        placeholder="Reps"
        value={value.reps || ""}
        onChange={(e) => onChange({ ...value, reps: e.target.value })}
      />

      {/* Absolute weight input */}
      {!value.strength && (
        <input
          type="number"
          placeholder="Weight (kg)"
          value={value.weight_kg ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              weight_kg: e.target.value ? Number(e.target.value) : null,
            })
          }
        />
      )}

      {/* % of 1RM */}
      <StrengthPrescriptionEditor
        value={value.strength}
        onChange={(strength) =>
          onChange({
            ...value,
            strength,
            weight_kg: null,
          })
        }
      />
    </div>
  );
}
