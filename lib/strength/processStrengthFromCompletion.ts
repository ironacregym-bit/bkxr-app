import firestore from "../firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

type GymCompletionSet = {
  exercise_id: string;
  set: number;
  weight: number | null;
  reps: number | null;
};

type StrengthExerciseConfig = {
  id: string; // doc id
  exercise_name: string; // display name that must match completion.exercise_id
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

export async function processStrengthFromCompletion(args: {
  completionId: string;
  userEmail: string;
}) {
  const { completionId, userEmail } = args;
  const user_key = normName(userEmail);

  const completionRef = firestore.collection("workoutCompletions").doc(completionId);
  const completionSnap = await completionRef.get();
  if (!completionSnap.exists) return { ok: false, reason: "completion_not_found" as const };

  const completion = completionSnap.data() as any;

  // idempotency
  if (completion?.processed_strength_version === 1) {
    return { ok: true, skipped: true as const };
  }

  const sets: GymCompletionSet[] = Array.isArray(completion?.sets) ? completion.sets : [];
  if (!sets.length) {
    // mark processed so we don't keep rechecking
    await completionRef.set(
      {
        processed_strength_version: 1,
        processed_strength_at: Timestamp.now(),
      },
      { merge: true }
    );
    return { ok: true, skipped: true as const };
  }

  // load tracked exercises
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
    // nothing to track; mark completion processed
    await completionRef.set(
      {
        processed_strength_version: 1,
        processed_strength_at: Timestamp.now(),
      },
      { merge: true }
    );
    return { ok: true, skipped: true as const };
  }

  const trackedByName = new Map<string, StrengthExerciseConfig>();
  for (const t of tracked) {
    if (!t.exercise_name) continue;
    trackedByName.set(normName(t.exercise_name), t);
  }

  const completedTS: Timestamp =
    completion?.completed_date?.toDate ? completion.completed_date : Timestamp.now();
  const date_key = toDateKey(completedTS);
  const workout_id = String(completion?.workout_id || "").trim();

  // group sets by tracked lift id
  const grouped = new Map<string, { cfg: StrengthExerciseConfig; sets: GymCompletionSet[] }>();

  for (const s of sets) {
    const name = normName(String(s?.exercise_id || ""));
    if (!name) continue;
    const cfg = trackedByName.get(name);
    if (!cfg) continue;

    const w = typeof s.weight === "number" ? s.weight : null;
    const r = typeof s.reps === "number" ? s.reps : null;
    if (w == null || r == null) continue;
    if (w <= 0 || r <= 0) continue;

    const bucket = grouped.get(cfg.id);
    if (bucket) bucket.sets.push(s);
    else grouped.set(cfg.id, { cfg, sets: [s] });
  }

  // if nothing matched, still mark processed
  if (grouped.size === 0) {
    await completionRef.set(
      {
        processed_strength_version: 1,
        processed_strength_at: Timestamp.now(),
      },
      { merge: true }
    );
    return { ok: true, skipped: true as const };
  }

  const profileRef = firestore.collection("strength_profiles").doc(user_key);

  // ensure profile exists
  await profileRef.set(
    {
      user_email: user_key,
      updated_at: Timestamp.now(),
    },
    { merge: true }
  );

  // process each lift: write entries + update summary doc
  const updates: Array<Promise<any>> = [];

  for (const [liftId, bucket] of grouped.entries()) {
    const { cfg, sets: liftSets } = bucket;

    const maxRep = Number(cfg.max_rep_for_e1rm ?? 10);
    const rounding = Number(cfg.rounding_kg ?? 2.5);
    const tmFactor = Number(cfg.training_max_factor ?? 0.9);

    let bestTrue: number | null = null;
    let bestE: number | null = null;

    // Build entry writes and compute bests from this completion
    for (const s of liftSets) {
      const w = s.weight as number;
      const r = s.reps as number;

      const true1 = r === 1 ? w : null;
      const e = r <= maxRep ? roundToIncrement(e1rm(w, r), rounding) : null;

      if (true1 != null) bestTrue = bestTrue == null ? true1 : Math.max(bestTrue, true1);
      if (e != null) bestE = bestE == null ? e : Math.max(bestE, e);

      const entryId = `${completionId}_${liftId}_${s.set}`;
      const entryRef = profileRef
        .collection("lifts")
        .doc(liftId)
        .collection("entries")
        .doc(entryId);

      updates.push(
        entryRef.set(
          {
            date_key,
            completion_id: completionId,
            workout_id,
            exercise_name: cfg.exercise_name,
            weight_kg: w,
            reps: r,
            e1rm_kg: e,
            true_1rm_kg: true1,
            created_at: Timestamp.now(),
          },
          { merge: true }
        )
      );
    }

    const liftRef = profileRef.collection("lifts").doc(liftId);

    updates.push(
      (async () => {
        const liftSnap = await liftRef.get();
        const cur = liftSnap.exists ? (liftSnap.data() as any) : {};

        const curTrue = typeof cur?.best_true_1rm_kg === "number" ? cur.best_true_1rm_kg : null;
        const curE = typeof cur?.best_e1rm_kg === "number" ? cur.best_e1rm_kg : null;

        const nextTrue = bestTrue != null ? (curTrue == null ? bestTrue : Math.max(curTrue, bestTrue)) : curTrue;
        const nextE = bestE != null ? (curE == null ? bestE : Math.max(curE, bestE)) : curE;

        const trainingMax =
          typeof nextE === "number" && nextE > 0 ? roundToIncrement(nextE * tmFactor, rounding) : cur?.training_max_kg ?? null;

        const patch: any = {
          exercise_name: cfg.exercise_name,
          updated_at: Timestamp.now(),
        };

        if (nextTrue != null && (curTrue == null || nextTrue > curTrue)) {
          patch.best_true_1rm_kg = nextTrue;
          patch.best_true_1rm_date = date_key;
          patch.best_true_1rm_completion_id = completionId;
        }

        if (nextE != null && (curE == null || nextE > curE)) {
          patch.best_e1rm_kg = nextE;
          patch.best_e1rm_date = date_key;
          patch.best_e1rm_completion_id = completionId;
        }

        if (trainingMax != null) patch.training_max_kg = trainingMax;

        await liftRef.set(patch, { merge: true });
      })()
    );
  }

  await Promise.all(updates);

  // mark completion processed
  await completionRef.set(
    {
      processed_strength_version: 1,
      processed_strength_at: Timestamp.now(),
    },
    { merge: true }
  );

  return { ok: true };
}
