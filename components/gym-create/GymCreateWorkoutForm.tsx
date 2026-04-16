"use client";

import React, { useMemo } from "react";
import type { DayName, ExerciseRow, GymRound, SingleItem, SupersetItem } from "./GymCreateWorkout.constants";
import { DAYS } from "./GymCreateWorkout.constants";

import SingleExerciseEditor from "./SingleExerciseEditor";
import SupersetEditor from "./SupersetEditor";
import { IA, neonCardStyle, neonPrimaryStyle, neonButtonStyle } from "../iron-acre/theme";

/* --------------------------------------------
   ✅ RoundSection MUST live at module scope
   -------------------------------------------- */
function RoundSection({
  title,
  roundKey,
  round,
  allowEmpty,
  basisOptions,
  exercises,
  onAddSingle,
  onAddSuperset,
  onUpdateSingle,
  onUpdateSuperset,
  onRemoveItem,
  onQuickAddSingle,
  onQuickAddSupersetSub,
}: {
  title: string;
  roundKey: "warmup" | "main" | "finisher";
  round: GymRound | null;
  allowEmpty?: boolean;
  basisOptions: string[];
  exercises: ExerciseRow[];
  onAddSingle: (round: "warmup" | "main" | "finisher") => void;
  onAddSuperset: (round: "warmup" | "main" | "finisher") => void;
  onUpdateSingle: (
    round: "warmup" | "main" | "finisher",
    idx: number,
    patch: Partial<SingleItem>
  ) => void;
  onUpdateSuperset: (
    round: "warmup" | "main" | "finisher",
    idx: number,
    patch: Partial<SupersetItem>
  ) => void;
  onRemoveItem: (round: "warmup" | "main" | "finisher", idx: number) => void;
  onQuickAddSingle: (round: "warmup" | "main" | "finisher", idx: number) => void;
  onQuickAddSupersetSub: (
    round: "warmup" | "main" | "finisher",
    idx: number,
    subIdx: number
  ) => void;
}) {
  return (
    <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="m-0">{title}</h6>

        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-sm"
            style={neonPrimaryStyle({ borderRadius: 24, paddingLeft: 14, paddingRight: 14 })}
            onClick={() => onAddSingle(roundKey)}
          >
            + Single
          </button>

          <button
            type="button"
            className="btn btn-sm"
            style={neonButtonStyle({ borderRadius: 24 })}
            onClick={() => onAddSuperset(roundKey)}
          >
            + Superset
          </button>
        </div>
      </div>

      {!round?.items?.length ? (
        <div className="small text-dim">{allowEmpty ? "Optional section." : "Add items."}</div>
      ) : (
        round.items.map((it, idx) =>
          it.type === "Single" ? (
            <div key={(it as SingleItem).uid} className="mb-2">
              <SingleExerciseEditor
                value={it as SingleItem}
                basisOptions={basisOptions}
                onChange={(patch) => onUpdateSingle(roundKey, idx, patch)}
                onDelete={() => onRemoveItem(roundKey, idx)}
              />

              <div className="d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-sm"
                  style={neonButtonStyle({ borderRadius: 24 })}
                  onClick={() => onQuickAddSingle(roundKey, idx)}
                >
                  ＋ Quick add exercise
                </button>
              </div>
            </div>
          ) : (
            <div key={(it as SupersetItem).uid} className="mb-2">
              <SupersetEditor
                exercises={exercises}
                basisOptions={basisOptions}
                value={it as SupersetItem}
                onChange={(patch) => onUpdateSuperset(roundKey, idx, patch)}
                onDelete={() => onRemoveItem(roundKey, idx)}
                onQuickAddSub={(subIdx) =>
                  onQuickAddSupersetSub(roundKey, idx, subIdx)
                }
              />
            </div>
          )
        )
      )}
    </section>
  );
}

/* --------------------------------------------
   ✅ Main form component
   -------------------------------------------- */
export default function GymCreateWorkoutForm({
  isEdit,
  ownerEmail,
  basisOptions,
  exercises,
  meta,
  setMeta,
  warmup,
  main,
  finisher,
  onAddSingle,
  onAddSuperset,
  onUpdateSingle,
  onUpdateSuperset,
  onRemoveItem,
  onQuickAddSingle,
  onQuickAddSupersetSub,
  onSave,
  saving,
  msg,
}: {
  isEdit: boolean;
  ownerEmail: string;
  basisOptions: string[];
  exercises: ExerciseRow[];
  meta: {
    workout_name: string;
    focus: string;
    notes: string;
    video_url: string;
    visibility: "global" | "private";
    recurring: boolean;
    recurring_day: DayName;
    recurring_start: string;
    recurring_end: string;
    assigned_to: string;
  };
  setMeta: (patch: Partial<typeof meta>) => void;
  warmup: GymRound | null;
  main: GymRound;
  finisher: GymRound | null;
  onAddSingle: (round: "warmup" | "main" | "finisher") => void;
  onAddSuperset: (round: "warmup" | "main" | "finisher") => void;
  onUpdateSingle: (
    round: "warmup" | "main" | "finisher",
    idx: number,
    patch: Partial<SingleItem>
  ) => void;
  onUpdateSuperset: (
    round: "warmup" | "main" | "finisher",
    idx: number,
    patch: Partial<SupersetItem>
  ) => void;
  onRemoveItem: (round: "warmup" | "main" | "finisher", idx: number) => void;
  onQuickAddSingle: (round: "warmup" | "main" | "finisher", idx: number) => void;
  onQuickAddSupersetSub: (
    round: "warmup" | "main" | "finisher",
    idx: number,
    subIdx: number
  ) => void;
  onSave: () => void;
  saving: boolean;
  msg: string | null;
}) {
  const AssignmentSection = useMemo(() => {
    return (
      <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
        <h6 className="mb-2">Assignment & Recurrence</h6>

        <div className="row g-2">
          <div className="col-md-4">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                checked={meta.recurring}
                onChange={(e) => setMeta({ recurring: e.target.checked })}
              />
              <label className="form-check-label">Recurring (weekly)</label>
            </div>
          </div>

          <div className="col-md-4">
            <label className="form-label">Assigned To</label>
            <input
              className="form-control"
              value={meta.assigned_to}
              onChange={(e) => setMeta({ assigned_to: e.target.value })}
              disabled={!meta.recurring}
            />
          </div>

          <div className="col-md-4">
            <label className="form-label">Day</label>
            <select
              className="form-select"
              value={meta.recurring_day}
              onChange={(e) => setMeta({ recurring_day: e.target.value as DayName })}
              disabled={!meta.recurring}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </section>
    );
  }, [meta, setMeta]);

  return (
    <>
      <h2 className="mb-3">{isEdit ? "Edit Gym Workout" : "Create Gym Workout"}</h2>

      {msg && (
        <div className={`alert ${msg.includes("Fail") ? "alert-danger" : "alert-info"}`}>
          {msg}
        </div>
      )}

      <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
        <div className="row g-2">
          <div className="col-md-6">
            <label className="form-label">Workout Name</label>
            <input
              className="form-control"
              value={meta.workout_name}
              onChange={(e) => setMeta({ workout_name: e.target.value })}
            />
          </div>

          <div className="col-md-3">
            <label className="form-label">Visibility</label>
            <select
              className="form-select"
              value={meta.visibility}
              onChange={(e) => setMeta({ visibility: e.target.value as any })}
            >
              <option value="global">Global</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label">Focus</label>
            <input
              className="form-control"
              value={meta.focus}
              onChange={(e) => setMeta({ focus: e.target.value })}
            />
          </div>

          <div className="col-12">
            <label className="form-label">Notes</label>
            <textarea
              className="form-control"
              value={meta.notes}
              onChange={(e) => setMeta({ notes: e.target.value })}
            />
          </div>

          <div className="col-md-6">
            <label className="form-label">Video URL</label>
            <input
              className="form-control"
              value={meta.video_url}
              onChange={(e) => setMeta({ video_url: e.target.value })}
            />
          </div>

          <div className="col-12 text-dim small">
            Tracked basis exercises: <span style={{ color: IA.neon }}>{basisOptions.length}</span>
          </div>
        </div>
      </section>

      {AssignmentSection}

      <RoundSection
        title="Warm Up"
        roundKey="warmup"
        round={warmup}
        basisOptions={basisOptions}
        exercises={exercises}
        onAddSingle={onAddSingle}
        onAddSuperset={onAddSuperset}
        onUpdateSingle={onUpdateSingle}
        onUpdateSuperset={onUpdateSuperset}
        onRemoveItem={onRemoveItem}
        onQuickAddSingle={onQuickAddSingle}
        onQuickAddSupersetSub={onQuickAddSupersetSub}
      />

      <RoundSection
        title="Main Set"
        roundKey="main"
        round={main}
        basisOptions={basisOptions}
        exercises={exercises}
        onAddSingle={onAddSingle}
        onAddSuperset={onAddSuperset}
        onUpdateSingle={onUpdateSingle}
        onUpdateSuperset={onUpdateSuperset}
        onRemoveItem={onRemoveItem}
        onQuickAddSingle={onQuickAddSingle}
        onQuickAddSupersetSub={onQuickAddSupersetSub}
      />

      <RoundSection
        title="Finisher"
        roundKey="finisher"
        round={finisher}
        allowEmpty
        basisOptions={basisOptions}
        exercises={exercises}
        onAddSingle={onAddSingle}
        onAddSuperset={onAddSuperset}
        onUpdateSingle={onUpdateSingle}
        onUpdateSuperset={onUpdateSuperset}
        onRemoveItem={onRemoveItem}
        onQuickAddSingle={onQuickAddSingle}
        onQuickAddSupersetSub={onQuickAddSupersetSub}
      />

      <button
        className="btn w-100 mt-2"
        onClick={onSave}
        disabled={saving}
        style={neonPrimaryStyle({ borderRadius: 24 })}
      >
        {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Gym Workout"}
      </button>
    </>
  );
}
