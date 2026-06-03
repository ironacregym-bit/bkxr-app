// components/program-create/ProgramMetaStep.tsx
"use client";

import React, { useMemo } from "react";

type ProgramMeta = {
  name: string;
  weeks: number;
};

export default function ProgramMetaStep({
  value,
  onChange,
  onNext,
}: {
  value: ProgramMeta;
  onChange: (patch: Partial<ProgramMeta>) => void;
  onNext: () => void;
}) {
  const canContinue = useMemo(() => {
    return Boolean(value.name.trim() && value.weeks > 0);
  }, [value]);

  return (
    <section className="futuristic-card p-3">
      <h6 className="mb-3">Program details</h6>

      <div className="row g-2">
        <div className="col-12 col-md-8">
          <label className="form-label">Program name</label>
          <input
            className="form-control"
            value={value.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Farm Strength – 12 Week Block"
          />
        </div>

        <div className="col-6 col-md-4">
          <label className="form-label">Weeks</label>
          <input
            type="number"
            min={1}
            max={24}
            className="form-control"
            value={value.weeks}
            onChange={(e) => onChange({ weeks: Number(e.target.value) || 12 })}
          />
        </div>
      </div>

      <div className="d-flex justify-content-end mt-3">
        <button
          className="btn btn-primary"
          style={{ borderRadius: 24 }}
          disabled={!canContinue}
          onClick={onNext}
        >
          Next: Weekly schedule →
        </button>
      </div>
    </section>
  );
}
