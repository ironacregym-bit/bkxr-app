// File: components/gym-create/GymCreateWorkoutForm.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { DayName, ExerciseRow, GymRound, SingleItem, SupersetItem } from "./GymCreateWorkout.constants";
import { DAYS } from "./GymCreateWorkout.constants";

import SingleExerciseEditor from "./SingleExerciseEditor";
import SupersetEditor from "./SupersetEditor";

type MemberRow = {
  email: string;
  name: string | null;
  membership_status: string | null;
  subscription_status: string | null;
  updated_at: string | null;
};

type MembersResp = {
  items?: MemberRow[];
  nextCursor?: string | null;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function normaliseEmail(v: string) {
  return String(v || "").trim().toLowerCase();
}

function formatMemberLabel(m: MemberRow) {
  const name = (m.name || "").trim();
  if (name) return `${name} • ${m.email}`;
  return m.email;
}

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
  onUpdateSingle: (round: "warmup" | "main" | "finisher", idx: number, patch: Partial<SingleItem>) => void;
  onUpdateSuperset: (round: "warmup" | "main" | "finisher", idx: number, patch: Partial<SupersetItem>) => void;
  onRemoveItem: (round: "warmup" | "main" | "finisher", idx: number) => void;
  onQuickAddSingle: (round: "warmup" | "main" | "finisher", idx: number) => void;
  onQuickAddSupersetSub: (round: "warmup" | "main" | "finisher", idx: number, subIdx: number) => void;
}) {
  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="ia-tile-title">{title}</div>

        <div className="d-flex gap-2">
          <button type="button" className="ia-btn ia-btn-primary" onClick={() => onAddSingle(roundKey)}>
            + Single
          </button>
          <button type="button" className="ia-btn ia-btn-outline" onClick={() => onAddSuperset(roundKey)}>
            + Superset
          </button>
        </div>
      </div>

      {!round?.items?.length ? (
        <div className="text-dim small">{allowEmpty ? "Optional section." : "Add items."}</div>
      ) : (
        round.items.map((it, idx) =>
          it.type === "Single" ? (
            <div key={(it as SingleItem).uid} className="mb-2">
              <SingleExerciseEditor
                value={it as SingleItem}
                exercises={exercises}
                basisOptions={basisOptions}
                onChange={(patch) => onUpdateSingle(roundKey, idx, patch)}
                onDelete={() => onRemoveItem(roundKey, idx)}
                onQuickAdd={() => onQuickAddSingle(roundKey, idx)}
              />
            </div>
          ) : (
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
  onUpdateSingle: (round: "warmup" | "main" | "finisher", idx: number, patch: Partial<SingleItem>) => void;
  onUpdateSuperset: (round: "warmup" | "main" | "finisher", idx: number, patch: Partial<SupersetItem>) => void;
  onRemoveItem: (round: "warmup" | "main" | "finisher", idx: number) => void;
  onQuickAddSingle: (round: "warmup" | "main" | "finisher", idx: number) => void;
  onQuickAddSupersetSub: (round: "warmup" | "main" | "finisher", idx: number, subIdx: number) => void;
  onSave: () => void;
  saving: boolean;
  msg: string | null;
}) {
  // Members list for assignment
  const { data: membersPage } = (require("swr") as typeof import("swr")).default<MembersResp>(
    "/api/admin/members/list?limit=80",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [membersQ, setMembersQ] = useState("");

  useEffect(() => {
    if (!membersPage) return;
    const incoming = Array.isArray(membersPage.items) ? membersPage.items : [];
    setMembers(incoming);
    setNextCursor(typeof membersPage.nextCursor === "string" ? membersPage.nextCursor : null);
  }, [membersPage]);

  async function loadMoreMembers() {
    if (!nextCursor) return;
    const url = `/api/admin/members/list?limit=80&cursor=${encodeURIComponent(nextCursor)}`;
    const json: MembersResp = await fetcher(url);
    const incoming = Array.isArray(json?.items) ? json.items : [];
    const cursor = typeof json?.nextCursor === "string" ? json.nextCursor : null;

    setMembers((prev) => {
      const seen = new Set(prev.map((p) => p.email));
      const merged = [...prev];
      for (const m of incoming) {
        if (!m?.email) continue;
        if (seen.has(m.email)) continue;
        merged.push(m);
      }
      return merged;
    });
    setNextCursor(cursor);
  }

  const filteredMembers = useMemo(() => {
    const q = membersQ.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const name = String(m.name || "").toLowerCase();
      const email = String(m.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [members, membersQ]);

  // Default assigned_to to ownerEmail when recurring toggles on and it's empty
  useEffect(() => {
    if (!meta.recurring) return;
    if (meta.assigned_to && meta.assigned_to.trim()) return;
    setMeta({ assigned_to: normaliseEmail(ownerEmail) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.recurring]);

  const alertClass = msg?.toLowerCase().includes("fail") || msg?.toLowerCase().includes("error") ? "alert-danger" : "alert-info";

  return (
    <>
      <div className="ia-page-title">{isEdit ? "Edit gym workout" : "Create gym workout"}</div>
      <div className="ia-page-subtitle text-dim">
        {isEdit ? "Update the workout and assignments." : "Build a workout and optionally set recurrence."}
      </div>

      {msg ? <div className={`alert ${alertClass} mt-3`}>{msg}</div> : null}

      <section className="ia-tile ia-tile-pad mt-3 mb-3">
        <div className="row g-2">
          <div className="col-md-6">
            <label className="form-label">Workout name</label>
            <input className="form-control" value={meta.workout_name} onChange={(e) => setMeta({ workout_name: e.target.value })} />
          </div>

          <div className="col-md-3">
            <label className="form-label">Visibility</label>
            <select className="form-select" value={meta.visibility} onChange={(e) => setMeta({ visibility: e.target.value as any })}>
              <option value="global">Global</option>
              <option value="private">Private</option>
            </select>
            <div className="text-dim small mt-1">
              Private workouts are owned by <span style={{ color: "var(--ia-neon)" }}>{normaliseEmail(ownerEmail)}</span>
            </div>
          </div>

          <div className="col-md-3">
            <label className="form-label">Focus</label>
            <input className="form-control" value={meta.focus} onChange={(e) => setMeta({ focus: e.target.value })} />
          </div>

          <div className="col-12">
            <label className="form-label">Notes</label>
            <textarea className="form-control" value={meta.notes} onChange={(e) => setMeta({ notes: e.target.value })} rows={3} />
          </div>

          <div className="col-md-6">
            <label className="form-label">Video URL</label>
            <input className="form-control" value={meta.video_url} onChange={(e) => setMeta({ video_url: e.target.value })} />
          </div>

          <div className="col-12 text-dim small">
            Tracked basis exercises: <span style={{ color: "var(--ia-neon)" }}>{basisOptions.length}</span>
          </div>
        </div>
      </section>

      <section className="ia-tile ia-tile-pad mb-3">
        <div className="ia-tile-title mb-2">Assignment & recurrence</div>

        <div className="row g-2">
          <div className="col-12 col-md-4">
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                checked={meta.recurring}
                onChange={(e) => setMeta({ recurring: e.target.checked })}
              />
              <label className="form-check-label">Recurring (weekly)</label>
            </div>
            <div className="text-dim small mt-1">Turn on to assign this workout to a member on a weekly schedule.</div>
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label">Assigned to</label>

            <input
              className="form-control"
              value={meta.assigned_to}
              onChange={(e) => setMeta({ assigned_to: normaliseEmail(e.target.value) })}
              disabled={!meta.recurring}
              list="ia-member-datalist"
              placeholder="Start typing a name or email…"
            />

            <datalist id="ia-member-datalist">
              {filteredMembers.slice(0, 60).map((m) => (
                <option key={m.email} value={m.email}>
                  {formatMemberLabel(m)}
                </option>
              ))}
            </datalist>

            {meta.recurring ? (
              <div className="d-flex align-items-center justify-content-between mt-2">
                <input
                  className="form-control"
                  style={{ maxWidth: 240 }}
                  value={membersQ}
                  onChange={(e) => setMembersQ(e.target.value)}
                  placeholder="Filter members…"
                />
                <button type="button" className="ia-btn ia-btn-outline" onClick={loadMoreMembers} disabled={!nextCursor}>
                  {nextCursor ? "Load more" : "All loaded"}
                </button>
              </div>
            ) : (
              <div className="text-dim small mt-2">Enable recurrence to assign a user.</div>
            )}
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label">Day</label>
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

          {meta.recurring ? (
            <>
              <div className="col-12 col-md-6">
                <label className="form-label">Start date</label>
                <input
                  className="form-control"
                  type="date"
                  value={meta.recurring_start || ""}
                  onChange={(e) => setMeta({ recurring_start: e.target.value })}
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label">End date</label>
                <input
                  className="form-control"
                  type="date"
                  value={meta.recurring_end || ""}
                  onChange={(e) => setMeta({ recurring_end: e.target.value })}
                />
              </div>

              <div className="col-12 text-dim small">
                Tip: set an end date for 12-week blocks so programs don’t run forever.
              </div>
            </>
          ) : null}
        </div>
      </section>

      <RoundSection
        title="Warm up"
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
        title="Main set"
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

      <button className="ia-btn ia-btn-primary w-100 mt-2" onClick={onSave} disabled={saving}>
        {saving ? "Saving…" : isEdit ? "Save changes" : "Create gym workout"}
      </button>
    </>
  );
}
