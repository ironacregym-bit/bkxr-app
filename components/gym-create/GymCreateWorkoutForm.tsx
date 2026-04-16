"use client";

import React, { useMemo } from "react";
import Link from "next/link";

import type {
  DayName,
  ExerciseRow,
  GymRound,
  SingleItem,
  SupersetItem,
} from "./GymCreateWorkout.constants";
import { DAYS } from "./GymCreateWorkout.constants";

import SingleExerciseEditor from "./SingleExerciseEditor";
import SupersetEditor from "./SupersetEditor";
import { IA, neonCardStyle, neonPrimaryStyle, neonButtonStyle } from "../iron-acre/theme";

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

  onUpdateSingle: (round: "warmup" | "main" | "finisher", idx: number, patch: Partial<SingleItem>) => void;
  onUpdateSuperset: (round: "warmup" | "main" | "finisher", idx: number, patch: Partial<SupersetItem>) => void;

  onRemoveItem: (round: "warmup" | "main" | "finisher", idx: number) => void;

  onQuickAddSingle: (round: "warmup" | "main" | "finisher", idx: number) => void;
  onQuickAddSupersetSub: (round: "warmup" | "main" | "finisher", idx: number, subIdx: number) => void;

  onSave: () => void;
  saving: boolean;
  msg: string | null;
}) {
  const AssignmentSection = useMemo(() => {
    return (
      <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
        <h6 className="m-0 mb-2">Assignment & Recurrence</h6>
        <div className="row g-2">
          <div className="col-12 col-md-4">
            <div className="form-check form-switch mt-1">
              <input
                className="form-check-input"
                type="checkbox"
                id="recurringSwitch"
                checked={meta.recurring}
                onChange={(e) => setMeta({ recurring: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="recurringSwitch">
                Recurring (weekly)
              </label>
            </div>
            <small className="text-dim d-block mt-1">
              When on: this session repeats weekly and becomes the user’s mandatory workout for that weekday.
            </small>
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label">Assigned To (email)</label>
            <input
              className="form-control"
              type="email"
              value={meta.assigned_to}
              onChange={(e) => setMeta({ assigned_to: e.target.value })}
              placeholder="athlete@example.com"
              disabled={!meta.recurring}
            />
            <small className="text-dim">Defaults to your email</small>
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label">Recurring Day</label>
            <select
              className="form-select"
              value={meta.recurring_day}
              onChange={(e) => setMeta({ recurring_day: e.target.value as DayName })}
              disabled={!meta.recurring}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label">Start Date</label>
            <input
              className="form-control"
              type="date"
              value={meta.recurring_start}
              onChange={(e) => setMeta({ recurring_start: e.target.value })}
              disabled={!meta.recurring}
            />
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label">End Date</label>
            <input
              className="form-control"
              type="date"
              value={meta.recurring_end}
              onChange={(e) => setMeta({ recurring_end: e.target.value })}
              disabled={!meta.recurring}
            />
          </div>
        </div>
      </section>
    );
  }, [meta, setMeta]);

  function RoundSection({
    title,
    roundKey,
    round,
    allowEmpty,
  }: {
    title: string;
    roundKey: "warmup" | "main" | "finisher";
    round: GymRound | null;
    allowEmpty?: boolean;
  }) {
    return (
      <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h6 className="m-0">{title}</h6>
          <div className="d-flex gap-2">
            <button
              className="btn btn-sm"
              style={neonPrimaryStyle({ borderRadius: 24, paddingLeft: 14, paddingRight: 14 })}
              onClick={() => onAddSingle(roundKey)}
            >
              + Single
            </button>
            <button
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
          round.items.map((it, idx) => {
            if (it.type === "Single") {
              return (
                <div key={(it as SingleItem).uid} className="mb-2">
                  {/* NOTE: SingleExerciseEditor currently uses a text input for exercise_id.
                      We will upgrade it in the next file batch to use ExerciseSelect + Quick Add. */}
                  <SingleExerciseEditor
                    value={it as any}
                    basisOptions={basisOptions}
                    onChange={(patch) => onUpdateSingle(roundKey, idx, patch)}
                    onDelete={() => onRemoveItem(roundKey, idx)}
                  />
                  <div className="d-flex justify-content-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-light"
                      style={{ borderRadius: 24 }}
                      onClick={() => onQuickAddSingle(roundKey, idx)}
                      title="Quick add/select exercise"
                    >
                      ＋ Quick add exercise
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={(it as SupersetItem).uid} className="mb-2">
                <SupersetEditor
                  exercises={exercises}
                  basisOptions={basisOptions}
                  value={it as SupersetItem}
                  onChange={(patch) => onUpdateSuperset(roundKey, idx, patch)}
                  onDelete={() => onRemoveItem(roundKey, idx)}
                  onQuickAddSub={(subIdx) => onQuickAddSupersetSub(roundKey, idx, subIdx)}
                />
              </div>
            );
          })
        )}
      </section>
    );
  }

  return (
    <>
      <div className="mb-3">
        <Link href="/admin" className="btn btn-outline-secondary">
          ← Back to Admin
        </Link>
      </div>

      <h2 className="mb-3">{isEdit ? "Edit Gym Workout" : "Create Gym Workout"}</h2>

      {msg ? (
        <div className={`alert ${msg.toLowerCase().includes("failed") ? "alert-danger" : "alert-info"}`}>{msg}</div>
      ) : null}

      <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
        <div className="row g-2">
          <div className="col-12 col-md-6">
            <label className="form-label">Workout Name</label>
            <input
              className="form-control"
              value={meta.workout_name}
              onChange={(e) => setMeta({ workout_name: e.target.value })}
            />
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label">Visibility</label>
            <select
              className="form-select"
              value={meta.visibility}
              onChange={(e) => setMeta({ visibility: e.target.value as any })}
            >
              <option value="global">Global</option>
              <option value="private">Private</option>
            </select>
            {meta.visibility === "private" ? <small className="text-muted">Owner: {ownerEmail || "—"}</small> : null}
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label">Focus</label>
            <input
              className="form-control"
              value={meta.focus}
              onChange={(e) => setMeta({ focus: e.target.value })}
              placeholder="e.g., Lower Body"
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

          <div className="col-12 col-md-6">
            <label className="form-label">Video URL</label>
            <input
              className="form-control"
              value={meta.video_url}
              onChange={(e) => setMeta({ video_url: e.target.value })}
              placeholder="https://…"
            />
          </div>

          <div className="col-12">
            <div className="text-dim small">
              Tracked basis exercises loaded: <span style={{ color: IA.neon }}>{basisOptions.length}</span>
            </div>
          </div>
        </div>
      </section>

      {AssignmentSection}

      <RoundSection title="Warm Up" roundKey="warmup" round={warmup} />
      <RoundSection title="Main Set" roundKey="main" round={main} />
      <RoundSection title
