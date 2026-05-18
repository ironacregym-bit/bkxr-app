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
  id: string; // strength_exercises doc id (canonical key)
  exercise_name: string; // display label
  tracked: boolean;
  max_rep_for_e1rm?: number | null;
  rounding_kg?: number | null;
  training_max_factor?: number | null;
};

function normKey(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
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
  return normKey(basis);
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

export async function processStrengthFromCompletion(args: { completionId: string; userEmail: string }) {
  const { completionId, userEmail } = args;
  const user_key = normKey(userEmail);

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
      : toTimestamp(new Date());

  const processedSourceTS: Timestamp | null =
    completion?.processed_strength_source_updated_at?.toDate ? completion.processed_strength_source_updated_at : null;

  // Edit-safe idempotency: skip only if we processed this same version of the completion
  if (
    completion?.processed_strength_version === 1 &&
    processedSourceTS &&
    processedSourceTS.toMillis() >= completionUpdatedTS.toMillis()
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

  // Lookup maps: doc id first, then display name
  const trackedById = new Map<string, StrengthExerciseConfig>();
  const trackedByName = new Map<string, StrengthExerciseConfig>();

  for (const t of tracked) {
    const idKey = normKey(t.id);
    const nameKey = normKey(t.exercise_name);
    if (idKey) trackedById.set(idKey, t);
    if (nameKey) trackedByName.set(nameKey, t);
  }

  const completedTS: Timestamp = completion?.completed_date?.toDate ? completion.completed_date : Timestamp.now();
  const date_key = toDateKey(completedTS);

  // Group sets by lift doc id (strength_exercises doc id)
  const grouped = new Map<string, { cfg: StrengthExerciseConfig; sets: GymCompletionSet[] }>();

  for (const s of sets) {
    const basisFromKey = extractBasisFromMovementKey(s.movement_key);
    const nameFromExerciseId = normKey(String(s?.exercise_id || ""));
    const lookupKey = basisFromKey || nameFromExerciseId;
    if (!lookupKey) continue;

    const cfg = trackedById.get(lookupKey) || trackedByName.get(lookupKey);
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

  await profileRef.set(
    {
      user_email: user_key,
      updated_at: Timestamp.now(),
    },
    { merge: true }
  );

  // ✅ No entries writes. Increase-only updates.
  for (const [liftId, bucket] of grouped.entries()) {
    const { cfg, sets: liftSets } = bucket;

    const maxRep = Number(cfg.max_rep_for_e1rm ?? 10);
    const rounding = Number(cfg.rounding_kg ?? 2.5);
    const tmFactor = Number(cfg.training_max_factor ?? 0.9);

    let bestTrueThisCompletion: number | null = null;
    let bestEThisCompletion: number | null = null;

    for (const s of liftSets) {
      const w = s.weight as number;
      const r = s.reps as number;

      if (r === 1) {
        bestTrueThisCompletion =
          bestTrueThisCompletion == null ? w : Math.max(bestTrueThisCompletion, w);
      }

      if (r <= maxRep) {
        const e = roundToIncrement(e1rm(w, r), rounding);
        bestEThisCompletion =
          bestEThisCompletion == null ? e : Math.max(bestEThisCompletion, e);
      }
    }

    const liftRef = profileRef.collection("lifts").doc(liftId);
    const liftSnap = await liftRef.get();
    const cur = liftSnap.exists ? (liftSnap.data() as any) : {};

    const curTrue = typeof cur?.best_true_1rm_kg === "number" ? cur.best_true_1rm_kg : null;
    const curE = typeof cur?.best_e1rm_kg === "number" ? cur.best_e1rm_kg : null;
    const curTM = typeof cur?.training_max_kg === "number" ? cur.training_max_kg : null;

    const patch: any = {
      exercise_name: cfg.exercise_name,
      updated_at: Timestamp.now(),
    };

    // ✅ Your requirement: only update 1RM if higher than before
    if (bestTrueThisCompletion != null && (curTrue == null || bestTrueThisCompletion > curTrue)) {
      patch.best_true_1rm_kg = bestTrueThisCompletion;
      patch.best_true_1rm_date = date_key;
      patch.best_true_1rm_completion_id = completionId;
    }

    // Optional but useful: keep e1RM and TM increase-only too
    if (bestEThisCompletion != null && (curE == null || bestEThisCompletion > curE)) {
      patch.best_e1rm_kg = bestEThisCompletion;
      patch.best_e1rm_date = date_key;
      patch.best_e1rm_completion_id = completionId;
    }

    // TM derived from best e1RM (increase-only)
    const nextE = typeof patch.best_e1rm_kg === "number" ? patch.best_e1rm_kg : curE;
    const nextTM =
      typeof nextE === "number" && nextE > 0 ? roundToIncrement(nextE * tmFactor, rounding) : null;

    if (nextTM != null && (curTM == null || nextTM > curTM)) {
      patch.training_max_kg = nextTM;
    }

    await liftRef.set(patch, { merge: true });
  }

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
