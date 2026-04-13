"use client";

import { ProgramDraft } from "../../pages/admin/programs/create";

export default function ProgramMetaStep({
  value,
  onChange,
  onNext,
}: {
  value: ProgramDraft;
  onChange: (v: ProgramDraft) => void;
  onNext: () => void;
}) {
  function addAssignee(email: string) {
    if (!email) return;
    if (value.assigned_to.includes(email)) return;
    onChange({
      ...value,
      assigned_to: [...value.assigned_to, email],
    });
  }

  function removeAssignee(email: string) {
    onChange({
      ...value,
      assigned_to: value.assigned_to.filter((e) => e !== email),
    });
  }

  const canContinue =
    value.name.trim() &&
    value.start_date &&
    value.weeks > 0 &&
    value.assigned_to.length > 0;

  return (
    <section className="futuristic-card p-3">
      <h6 className="mb-3">Program details</h6>

      <div className="row g-2">
        <div className="col-12 col-md-6">
          <label className="form-label">Program name</label>
          <input
            className="form-control"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="Iron Acre Strength – Block A"
          />
        </div>

        <div className="col-6 col-md-3">
          <label className="form-label">Start date</label>
          <input
            type="date"
            className="form-control"
            value={value.start_date}
            onChange={(e) => onChange({ ...value, start_date: e.target.value })}
          />
        </div>

        <div className="col-6 col-md-3">
          <label className="form-label">Weeks</label>
          <input
            type="number"
            min={1}
            max={24}
            className="form-control"
            value={value.weeks}
            onChange={(e) =>
              onChange({
                ...value,
                weeks: Number(e.target.value) || 12,
              })
            }
          />
        </div>

        <div className="col-12">
          <label className="form-label">Assign to athletes</label>

          <input
            type="email"
            className="form-control"
            placeholder="athlete@example.com"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAssignee((e.target as HTMLInputElement).value.toLowerCase());
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />

          <div className="d-flex flex-wrap gap-2 mt-2">
            {value.assigned_to.map((email) => (
              <span
                key={email}
                className="badge"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  padding: "6px 10px",
                }}
              >
                {email}{" "}
                <button
                  type="button"
                  className="btn btn-sm btn-link text-light ms-1"
                  onClick={() => removeAssignee(email)}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
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
