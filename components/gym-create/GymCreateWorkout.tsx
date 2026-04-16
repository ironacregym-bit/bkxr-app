"use client";

import React, { useEffect, useMemo, useState } from "react";
import QuickAddExerciseModal from "./QuickAddExerciseModal";
import GymCreateWorkoutForm from "./GymCreateWorkoutForm";
import {
  DAYS,
  type AdminWorkoutFetch,
  type ExerciseRow,
  type GymRound,
  type QuickTarget,
  type SingleItem,
  type SupersetItem,
  newSingleItem,
  newSupersetItem,
  renumber,
  toUIRound,
  toYMD,
} from "./GymCreateWorkout.constants";
import { IA } from "../iron-acre/theme";

export default function GymCreateWorkout({
  isEdit,
  editId,
  ownerEmail,
  exercises,
  basisOptions,
  initialWorkout,
  initialWorkoutError,
  onExercisesCreated,
  onDone,
}: {
  isEdit: boolean;
  editId: string;
  ownerEmail: string;
  exercises: ExerciseRow[];
  basisOptions: string[];
  initialWorkout: AdminWorkoutFetch | null;
  initialWorkoutError: string | null;
  onExercisesCreated: () => Promise<void> | void;
  onDone: (workoutId: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [meta, setMetaState] = useState({
    workout_name: "",
    focus: "",
    notes: "",
    video_url: "",
    visibility: "global" as "global" | "private",

    recurring: false,
    recurring_day: "Monday" as (typeof DAYS)[number],
    recurring_start: "" as string,
    recurring_end: "" as string,
    assigned_to: ownerEmail || "",
  });

  const [warmup, setWarmup] = useState<GymRound | null>({ name: "Warm Up", order: 1, items: [] });
  const [main, setMain] = useState<GymRound>({ name: "Main Set", order: 2, items: [] });
  const [finisher, setFinisher] = useState<GymRound | null>(null);

  // Quick Add Exercise modal state
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickErr, setQuickErr] = useState<string | null>(null);
  const [quickForm, setQuickForm] = useState({
    exercise_name: "",
    type: "",
    equipment: "",
    video_url: "",
    met_value: "" as string | number,
    description: "",
  });
  const [quickTarget, setQuickTarget] = useState<QuickTarget | null>(null);

  const [prefilled, setPrefilled] = useState(false);

  function setMeta(patch: Partial<typeof meta>) {
    setMetaState((m) => ({ ...m, ...patch }));
  }

  // Prefill in edit mode when initialWorkout arrives
  useEffect(() => {
    if (!isEdit) return;
    if (!initialWorkout) return;
    if (prefilled) return;

    const w = initialWorkout;

    const dayRaw = String(w.recurring_day ?? "").trim();
    const day = (DAYS as readonly string[]).includes(dayRaw) ? (dayRaw as any) : meta.recurring_day;

    setMetaState((m) => ({
      ...m,
      workout_name: w.workout_name || "",
      focus: w.focus || "",
      notes: w.notes || "",
      video_url: w.video_url || "",
      visibility: (w.visibility || "global") as any,
      recurring: !!w.recurring,
      recurring_day: day,
      recurring_start: toYMD(w.recurring_start),
      recurring_end: toYMD(w.recurring_end),
      assigned_to: String((w.assigned_to || ownerEmail || "") as any).toLowerCase(),
    }));

    const uiWarm = toUIRound(w.warmup, "Warm Up", 1);
    const uiMain = toUIRound(w.main || { name: "Main Set", order: 2, items: [] }, "Main Set", 2);
    const uiFin = toUIRound(w.finisher, "Finisher", 3);

    setWarmup(uiWarm);
    setMain(uiMain || { name: "Main Set", order: 2, items: [] });
    setFinisher(uiFin);

    setPrefilled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, initialWorkout, prefilled, ownerEmail]);

  // Surface initialWorkoutError if present
  useEffect(() => {
    if (initialWorkoutError) {
      setMsg(initialWorkoutError);
    }
  }, [initialWorkoutError]);

  function getRoundSetter(round: "warmup" | "main" | "finisher") {
    if (round === "warmup") return setWarmup;
    if (round === "main") return setMain;
    return setFinisher;
  }

  function addSingle(round: "warmup" | "main" | "finisher") {
    const setter = getRoundSetter(round);
    const newItem = newSingleItem();

    setter((prev: any) => {
      if (!prev) {
        if (round === "finisher") return { name: "Finisher", order: 3, items: [newItem] };
        return prev;
      }
      const items = renumber([...(prev.items || []), { ...newItem, order: (prev.items?.length || 0) + 1 }]);
      return { ...prev, items };
    });
  }

  function addSuperset(round: "warmup" | "main" | "finisher") {
    const setter = getRoundSetter(round);
    const newItem = newSupersetItem();

    setter((prev: any) => {
      if (!prev) {
        if (round === "finisher") return { name: "Finisher", order: 3, items: [newItem] };
        return prev;
      }
      const items = renumber([...(prev.items || []), { ...newItem, order: (prev.items?.length || 0) + 1 }]);
      return { ...prev, items };
    });
  }

  function updateSingle(round: "warmup" | "main" | "finisher", idx: number, patch: Partial<SingleItem>) {
    const setter = getRoundSetter(round);
    setter((prev: any) => {
      if (!prev) return prev;
      const items = (prev.items || []).map((it: any, i: number) => (i === idx ? { ...(it as SingleItem), ...patch } : it));
      return { ...prev, items };
    });
  }

  function updateSuperset(round: "warmup" | "main" | "finisher", idx: number, patch: Partial<SupersetItem>) {
    const setter = getRoundSetter(round);
    setter((prev: any) => {
      if (!prev) return prev;
      const items = (prev.items || []).map((it: any, i: number) => (i === idx ? { ...(it as SupersetItem), ...patch } : it));
      return { ...prev, items };
    });
  }

  function removeItem(round: "warmup" | "main" | "finisher", idx: number) {
    const setter = getRoundSetter(round);
    setter((prev: any) => {
      if (!prev) return prev;
      const nextItems = (prev.items || []).filter((_: any, i: number) => i !== idx);
      if (round === "finisher" && nextItems.length === 0) return null;
      return { ...prev, items: renumber(nextItems) };
    });
  }

  function openQuick(target: QuickTarget) {
    setQuickTarget(target);
    setQuickForm({
      exercise_name: "",
      type: "",
      equipment: "",
      video_url: "",
      met_value: "",
      description: "",
    });
    setQuickErr(null);
    setQuickOpen(true);
  }

  function openQuickSingle(round: "warmup" | "main" | "finisher", idx: number) {
    openQuick({ kind: "single", round, idx });
  }

  function openQuickSupersetSub(round: "warmup" | "main" | "finisher", idx: number, subIdx: number) {
    openQuick({ kind: "superset", round, idx, subIdx });
  }

  function applyQuickSelection(newId: string) {
    if (!quickTarget) return;

    if (quickTarget.kind === "single") {
      updateSingle(quickTarget.round, quickTarget.idx, { exercise_id: newId });
      return;
    }

    // superset sub
    const { round, idx, subIdx } = quickTarget;
    // patch the superset item by updating the sub item
    const setter = getRoundSetter(round);
    setter((prev: any) => {
      if (!prev) return prev;
      const items = (prev.items || []).map((it: any, i: number) => {
        if (i !== idx) return it;
        const ss = it as SupersetItem;
        const subItems = [...(ss.items || [])];
        subItems[subIdx] = { ...subItems[subIdx], exercise_id: newId };
        return { ...ss, items: subItems };
      });
      return { ...prev, items };
    });
  }

  async function createQuickExercise() {
    try {
      setQuickBusy(true);
      setQuickErr(null);

      const body = {
        exercise_name: quickForm.exercise_name.trim(),
        type: quickForm.type.trim(),
        equipment: quickForm.equipment.trim(),
        video_url: quickForm.video_url.trim(),
        met_value:
          quickForm.met_value === ""
            ? null
            : Number.isFinite(Number(quickForm.met_value))
            ? Number(quickForm.met_value)
            : null,
        description: quickForm.description.trim(),
      };

      if (!body.exercise_name) {
        setQuickErr("Exercise name is required");
        return;
      }

      const res = await fetch("/api/exercises/create?upsert=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to create exercise");

      await Promise.resolve(onExercisesCreated());
      const newId: string = json?.exercise_id || body.exercise_name;

      applyQuickSelection(newId);
      setQuickOpen(false);
    } catch (e: any) {
      setQuickErr(e?.message || "Failed to create exercise");
    } finally {
      setQuickBusy(false);
    }
  }

  function toISODateOrNull(s: string): string | null {
    if (!s) return null;
    const dt = new Date(s);
    if (isNaN(dt.getTime())) return null;
    dt.setHours(12, 0, 0, 0);
    return dt.toISOString();
  }

  function stripRound(round: GymRound | null): any | null {
    if (!round) return null;
    return {
      name: round.name,
      order: round.order,
      items: (round.items || []).map((it) => {
        if (it.type === "Superset") {
          const ss = it as SupersetItem;
          return {
            type: "Superset",
            order: ss.order,
            name: ss.name || "",
            sets: Number.isFinite(ss.sets) ? ss.sets : 3,
            rest_s: ss.rest_s ?? null,
            notes: ss.notes ?? null,
            items: (ss.items || []).map((s) => ({
              exercise_id: s.exercise_id,
              reps: s.reps || "",
              weight_kg: s.weight_kg ?? null,
              strength: s.strength ?? null,
            })),
          };
        }

        const si = it as SingleItem;
        return {
          type: "Single",
          order: si.order,
          exercise_id: si.exercise_id,
          sets: si.sets,
          reps: si.reps || "",
          weight_kg: si.weight_kg ?? null,
          rest_s: si.rest_s ?? null,
          notes: si.notes ?? null,
          strength: si.strength
            ? {
                basis_exercise: si.strength.basis_exercise ?? null,
                percent_1rm: si.strength.percent_1rm ?? null,
                percent_min: si.strength.percent_min ?? null,
                percent_max: si.strength.percent_max ?? null,
                rounding_kg: si.strength.rounding_kg ?? null,
                mode: si.strength.mode ?? null,
              }
            : null,
        };
      }),
    };
  }

  async function saveWorkout() {
    setSaving(true);
    setMsg(null);

    try {
      if (!meta.workout_name.trim()) throw new Error("Workout name is required.");

      if (meta.recurring) {
        if (!meta.assigned_to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(meta.assigned_to)) {
          throw new Error("Please enter a valid email for 'Assigned To'.");
        }
        if (!DAYS.includes(meta.recurring_day)) {
          throw new Error("Please choose a valid recurring day.");
        }
        if (!meta.recurring_start || !meta.recurring_end) {
          throw new Error("Please choose both a start and end date for recurrence.");
        }
        const start = new Date(meta.recurring_start);
        const end = new Date(meta.recurring_end);
        if (start > end) throw new Error("Recurring start date must be before end date.");
      }

      const payload: any = {
        ...(isEdit ? { workout_id: editId } : null),
        visibility: meta.visibility,
        owner_email: meta.visibility === "private" ? ownerEmail : undefined,
        workout_name: meta.workout_name.trim(),
        focus: meta.focus.trim() || undefined,
        notes: meta.notes.trim() || undefined,
        video_url: meta.video_url.trim() || undefined,
        warmup: stripRound(warmup),
        main: stripRound(main),
        finisher: stripRound(finisher),

        recurring: !!meta.recurring,
        recurring_day: meta.recurring ? meta.recurring_day : null,
        recurring_start: meta.recurring ? toISODateOrNull(meta.recurring_start) : null,
        recurring_end: meta.recurring ? toISODateOrNull(meta.recurring_end) : null,
        assigned_to: meta.recurring ? meta.assigned_to.trim().toLowerCase() : null,
      };

      const url = isEdit ? "/api/workouts/admin/update" : "/api/workouts/gym-create";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || (isEdit ? "Failed to update workout" : "Failed to create workout"));

      setMsg(isEdit ? "Saved changes ✅" : "Created ✅");
      const workoutId = json?.workout_id || editId;
      onDone(workoutId);
    } catch (e: any) {
      setMsg(e?.message || (isEdit ? "Failed to save workout" : "Failed to create workout"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <GymCreateWorkoutForm
        isEdit={isEdit}
        ownerEmail={ownerEmail}
        exercises={exercises}
        basisOptions={basisOptions}
        meta={meta}
        setMeta={setMeta}
        warmup={warmup}
        main={main}
        finisher={finisher}
        onAddSingle={addSingle}
        onAddSuperset={addSuperset}
        onUpdateSingle={updateSingle}
        onUpdateSuperset={updateSuperset}
        onRemoveItem={removeItem}
        onQuickAddSingle={openQuickSingle}
        onQuickAddSupersetSub={openQuickSupersetSub}
        onSave={saveWorkout}
        saving={saving}
        msg={msg}
      />

      <QuickAddExerciseModal
        open={quickOpen}
        accent={IA.neon}
        busy={quickBusy}
        error={quickErr}
        form={quickForm}
        setForm={setQuickForm}
        onClose={() => setQuickOpen(false)}
        onSave={createQuickExercise}
      />
    </>
  );
}
