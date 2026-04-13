// components/gym-create/StrengthPrescriptionEditor.tsx
export default function StrengthPrescriptionEditor({
  value,
  onChange,
}: {
  value: any;
  onChange: (v: any) => void;
}) {
  return (
    <div style={{ marginTop: 8 }}>
      <h4>% of 1RM</h4>

      <input
        placeholder="Basis exercise (e.g. Barbell Deadlift)"
        value={value?.basis_exercise || ""}
        onChange={(e) =>
          onChange({ ...(value || {}), basis_exercise: e.target.value })
        }
      />

      <input
        type="number"
        step="0.05"
        placeholder="Percent (e.g. 0.8)"
        value={value?.percent_1rm ?? ""}
        onChange={(e) =>
          onChange({
            ...(value || {}),
            percent_1rm: e.target.value ? Number(e.target.value) : null,
          })
        }
      />

      <input
        type="number"
        placeholder="Rounding kg"
        value={value?.rounding_kg ?? ""}
        onChange={(e) =>
          onChange({
            ...(value || {}),
            rounding_kg: e.target.value ? Number(e.target.value) : null,
          })
        }
      />

      <button onClick={() => onChange(null)}>Remove % prescription</button>
    </div>
  );
}
