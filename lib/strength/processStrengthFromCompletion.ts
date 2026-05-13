// File: lib/strength/processStrengthFromCompletion.ts

import firestore from "../firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

type GymCompletionSet = {
  exercise_id: string;
  set: number;
  weight: number | null;
  reps: number | null;
  movement_key?: string | null;
};

type StrengthExerciseConfig = {
  id: string; // doc id
  exercise_name: string; // display name expected to match basis exercise name (not IDs)
  tracked: boolean;
  max_rep_for_e1rm?: number | null;
  rounding_kg?: number | null;
  training_max_factor?: number | null;
};

function normName(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toDateKey(ts: Timestamp) {
  const d = ts.toDate();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function roundToIncrement(value: number, inc: number) {
  if (!inc || inc <= 0) return Math.round(value);
  return Math.round(value / inc) * inc;
}

// Epley
function e1rm(weight: number, reps: number) {
  return weight * (1 + reps / 30);
}

function extractBasisFromMovementKey(movementKey?: string | null) {
  const raw = String(movementKey || "").trim();
  if (!raw) return "";
  const basis = raw.split("|")[0] || "";
  return normName(basis);
}

function toTimestamp(v: any): Timestamp {
  try {
    if (v && typeof v.toDate === "function") return v as Timestamp;
    if (v instanceof Date) return Timestamp.fromDate(v);
    const d = new Date(v);
    return isNaN(d.getTime()) ? Timestamp.now() : Timestamp.fromDate(d);
  } catch {
    return Timestamp.now();
  }
}

async function deleteEntriesForCompletion(entriesCol: FirebaseFirestore.CollectionReference, completionId: string) {
  const snap = await entriesCol.where("completion_id", "==", completionId).get();
  if (snap.empty) return;

  const batch = firestore.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

async function recomputeLiftSummary(args: {
  liftRef: FirebaseFirestore.DocumentReference;
  entriesCol: FirebaseFirestore.CollectionReference;
  cfg: StrengthExerciseConfig;
}) {
  const { liftRef, entriesCol, cfg } = args;

  const rounding = Number(cfg.rounding_kg ?? 2.5);
  const tmFactor = Number(cfg.training_max_factor ?? 0.9);

  const allEntriesSnap = await entriesCol.get();

  let bestTrue: number | null = null;
  let bestE: number | null = null;
  let bestTrueMeta: any = null;
  let bestEMeta: any = null;

  allEntriesSnap.docs.forEach((d) => {
    const x = d.data() as any;

    const t = typeof x.true_1rm_kg === "number" ? x.true_1rm_kg : null;
    const e = typeof x.e1rm_kg === "number" ? x.e1rm_kg : null;

    if (t != null && (bestTrue == null || t > bestTrue)) {
      bestTrue = t;
      bestTrueMeta = x;
    }

    if (e != null && (bestE == null || e > bestE)) {
      bestE = e;
      bestEMeta = x;
    }
  });

  const trainingMax =
    typeof bestE === "number" && bestE > 0 ? roundToIncrement(bestE * tmFactor, rounding) : null;

  const patch: any = {
    exercise_name: cfg.exercise_name,
    updated_at: Timestamp.now(),
  };

  // If no entries exist (e.g. edits removed sets), clear bests + TM so UI doesn't show stale numbers
  if (bestTrue == null) {
    patch.best_true_1rm_kg = null;
    patch.best_true_1rm_date = null;
    patch.best_true_1rm_completion_id = null;
  } else {
    patch.best_true_1rm_kg = bestTrue;
    patch.best_true_1rm_date = bestTrueMeta?.date_key ?? null;
    patch.best_true_1rm_completion_id = bestTrueMeta?.completion_id ?? null;
  }

  if (bestE == null) {
    patch.best_e1rm_kg = null;
    patch.best_e1rm_date = null;
    patch.best_e1rm_completion_id = null;
  } else {
    patch.best_e1rm_kg = bestE;
    patch.best_e1rm_date = bestEMeta?.date_key ?? null;
    patch.best_e1rm_completion_id = bestEMeta?.completion_id ?? null;
  }

  patch.training_max_kg = trainingMax;

  await liftRef.set(patch, { merge: true });
}

export async function processStrengthFromCompletion(args: { completionId: string; userEmail: string }) {
  const { completionId, userEmail } = args;
  const user_key = normName(userEmail);

  const completionRef = firestore.collection("workoutCompletions").doc(completionId);
  const completionSnap = await completionRef.get();
  if (!completionSnap.exists) return { ok: false, reason: "completion_not_found" as const };

  const completion = completionSnap.data() as any;

  const completionUpdatedTS: Timestamp =
    completion?.updated_at?.toDate
      ? completion.updated_at
      : completion?.created_at?.toDate
      ? completion.created_at
      : completion?.completed_date?.toDate
      ? completion.completed_date
      : toTimestamp(Timestamp.now());

  const prevProcessedSourceTS: Timestamp | null =
    completion?.processed_strength_source_updated_at?.toDate ? completion.processed_strength_source_updated_at : null;

  // Edit-safe idempotency: skip only if we already processed this version of the completion
  if (
    completion?.processed_strength_version === 1 &&
    prevProcessedSourceTS &&
    prevProcessedSourceTS.toMillis() >= completionUpdatedTS.toMillis()
  ) {
    return { ok: true, skipped: true as const };
  }

  const sets: GymCompletionSet[] = Array.isArray(completion?.sets) ? completion.sets : [];
  if (!sets.length) {
    await completionRef.set(
      {
        processed_strength_version: 1,
        processed_strength_at: Timestamp.now(),
        processed_strength_source_updated_at: completionUpdatedTS,
      },
      { merge: true }
    );
    return { ok: true, skipped: true as const };
  }

  // Load tracked exercises
  const exSnap = await firestore.collection("strength_exercises").where("tracked", "==", true).get();
  const tracked: StrengthExerciseConfig[] = exSnap.docs.map((d) => {
    const x = d.data() as any;
    return {
      id: d.id,
      exercise_name: String(x?.exercise_name || "").trim(),
      tracked: Boolean(x?.tracked),
      max_rep_for_e1rm: x?.max_rep_for_e1rm ?? 10,
      rounding_kg: x?.rounding_kg ?? 2.5,
      training_max_factor: x?.training_max_factor ?? 0.9,
    };
  });

  if (!tracked.length) {
    await completionRef.set(
      {
        processed_strength_version: 1,
        processed_strength_at: Timestamp.now(),
        processed_strength_source_updated_at: completionUpdatedTS,
      },
      { merge: true }
    );
    return { ok: true, skipped: true as const };
  }

  const trackedByName = new Map<string, StrengthExerciseConfig>();
  for (const t of tracked) {
    const k = normName(t.exercise_name);
    if (!k) continue;
    trackedByName.set(k, t);
  }

  const completedTS: Timestamp = completion?.completed_date?.toDate ? completion.completed_date : Timestamp.now();
  const date_key = toDateKey(completedTS);
  const workout_id = String(completion?.workout_id || "").trim();

  // Group sets by tracked lift id (prefer basis from movement_key; fallback to exercise_id)
  const grouped = new Map<string, { cfg: StrengthExerciseConfig; sets: GymCompletionSet[] }>();

  for (const s of sets) {
    const basisFromKey = extractBasisFromMovementKey(s.movement_key);
    const nameFromExerciseId = normName(String(s?.exercise_id || ""));
    const lookupName = basisFromKey || nameFromExerciseId;
    if (!lookupName) continue;

    const cfg = trackedByName.get(lookupName);
    if (!cfg) continue;

    const w = typeof s.weight === "number" ? s.weight : null;
    const r = typeof s.reps === "number" ? s.reps : null;
    if (w == null || r == null) continue;
    if (w <= 0 || r <= 0) continue;

    const bucket = grouped.get(cfg.id);
    if (bucket) bucket.sets.push(s);
    else grouped.set(cfg.id, { cfg, sets: [s] });
  }

  if (grouped.size === 0) {
    await completionRef.set(
      {
        processed_strength_version: 1,
        processed_strength_at: Timestamp.now(),
        processed_strength_source_updated_at: completionUpdatedTS,
      },
      { merge: true }
    );
    return { ok: true, skipped: true as const };
  }

  const profileRef = firestore.collection("strength_profiles").doc(user_key);

  // Ensure profile exists
  await profileRef.set(
    {
      user_email: user_key,
      updated_at: Timestamp.now(),
    },
    { merge: true }
  );

  // Phase 1: delete old entries for this completion and write new entries
  for (const [liftId, bucket] of grouped.entries()) {
    const { cfg, sets: liftSets } = bucket;

    const maxRep = Number(cfg.max_rep_for_e1rm ?? 10);
    const rounding = Number(cfg.rounding_kg ?? 2.5);

    const liftRef = profileRef.collection("lifts").doc(liftId);
    const entriesCol = liftRef.collection("entries");

    await deleteEntriesForCompletion(entriesCol, completionId);

    const batch = firestore.batch();

    for (const s of liftSets) {
      const w = s.weight as number;
      const r = s.reps as number;

      const true1 = r === 1 ? w : null;
      const e = r <= maxRep ? roundToIncrement(e1rm(w, r), rounding) : null;

      const entryId = `${completionId}_${liftId}_${s.set}`;
      const entryRef = entriesCol.doc(entryId);

      batch.set(
        entryRef,
        {
          date_key,
          completion_id: completionId,
          workout_id,
          exercise_name: cfg.exercise_name,
          weight_kg: w,
          reps: r,
          e1rm_kg: e,
          true_1rm_kg: true1,
          movement_key: s.movement_key ?? null,
          created_at: Timestamp.now(),
        },
        { merge: true }
      );
    }

    await batch.commit();

    // Ensure lift doc exists at least with name
    await liftRef.set(
      {
        exercise_name: cfg.exercise_name,
        updated_at: Timestamp.now(),
      },
      { merge: true }
    );
  }

  // Phase 2: recompute lift bests from all entries (so edits can fix mistakes)
  for (const [liftId, bucket] of grouped.entries()) {
    const { cfg } = bucket;
    const liftRef = profileRef.collection("lifts").doc(liftId);
    const entriesCol = liftRef.collection("entries");
    await recomputeLiftSummary({ liftRef, entriesCol, cfg });
  }

  // Mark completion processed for this version
  await completionRef.set(
    {
      processed_strength_version: 1,
      processed_strength_at: Timestamp.now(),
      processed_strength_source_updated_at: completionUpdatedTS,
    },
    { merge: true }
  );

  return { ok: true };
}
