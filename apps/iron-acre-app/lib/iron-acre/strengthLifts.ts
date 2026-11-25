// File: lib/iron-acre/strengthLifts.ts
export type StrengthProfile = {
  training_maxes?: Record<string, number>;
  true_1rms?: Record<string, number>;
  rounding_increment_kg?: number;
  updated_at?: any;
};

export type StrengthExercise = {
  id: string;
  exercise_name: string;
  tracked?: boolean;
  rounding_kg?: number | null;
  max_rep_for_e1rm?: number | null;
  training_max_factor?: number | null;
};

export type LiftDef = {
  key: string;
  label: string;
  exerciseIds: string[];
  exerciseNameAliases: string[];
};

// IMPORTANT: set deadlift canonical ids once confirmed in Firestore
const DEADLIFT_IDS = ["barbell_deadlift"];

export const BIG_LIFTS: LiftDef[] = [
  {
    key: "deadlift",
    label: "Deadlift",
    exerciseIds: DEADLIFT_IDS,
    exerciseNameAliases: [
      "Deadlift",
      "Barbell Deadlift",
    ],
  },
  {
    key: "back_squat",
    label: "Back Squat",
    exerciseIds: ["barbell_back_squat"],
    exerciseNameAliases: [
      "Back Squat",
      "Barbell Back Squat",
      "Barbell Squat",
    ],
  },
  {
    key: "bench_press",
    label: "Bench Press",
    exerciseIds: ["barbell_flat_bench_press"],
    exerciseNameAliases: [
      "Bench Press",
      "Barbell Bench Press",
      "Barbell Flat Bench Press",
    ],
  },
  {
    key: "overhead_press",
    label: "Overhead Press",
    exerciseIds: ["barbell_strict_press"],
    exerciseNameAliases: [
      "Overhead Press",
      "Barbell Overhead Press",
      "Strict Press",
      "Barbell Strict Press",
    ],
  },
];

export function getLiftDef(liftKey: string): LiftDef | undefined {
  return BIG_LIFTS.find((l) => l.key === liftKey);
}

/**
 * Loose normalisation for comparing ids / names across legacy and current data.
 *
 * Examples:
 * - "Barbell Squat"        -> "barbell squat"
 * - "barbell_back_squat"   -> "barbell back squat"
 * - "Barbell-Back-Squat"   -> "barbell back squat"
 */
export function normaliseName(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Canonical lift resolver for known alias drift.
 *
 * This is the key fix for historical rename issues like:
 * - "Barbell Squat"
 * - "Barbell Back Squat"
 * - "Back Squat"
 *
 * All of those should resolve to the same canonical lift key:
 *   back_squat
 */
export function canonicaliseLiftAlias(value: string) {
  const v = normaliseName(value);

  if (
    v === "back squat" ||
    v === "barbell back squat" ||
    v === "barbell squat" ||
    v === "bb squat"
  ) {
    return "back_squat";
  }

  if (
    v === "deadlift" ||
    v === "barbell deadlift"
  ) {
    return "deadlift";
  }

  if (
    v === "bench press" ||
    v === "barbell bench press" ||
    v === "barbell flat bench press"
  ) {
    return "bench_press";
  }

  if (
    v === "overhead press" ||
    v === "barbell overhead press" ||
    v === "strict press" ||
    v === "barbell strict press"
  ) {
    return "overhead_press";
  }

  // fallback to underscore token for generic equality
  return v.replace(/\s+/g, "_");
}

/**
 * Match completion set.exercise_id or exercise_name against a lift.
 *
 * Supports:
 * - canonical doc ids (preferred)
 * - legacy stored display names
 * - renamed aliases
 */
export function matchesLiftExerciseId(exerciseIdFromCompletion: string, lift: LiftDef) {
  const incomingCanonical = canonicaliseLiftAlias(exerciseIdFromCompletion);

  // direct route-key canonical match
  if (incomingCanonical === lift.key) return true;

  const idCanonicals = new Set(lift.exerciseIds.map((x) => canonicaliseLiftAlias(x)));
  if (idCanonicals.has(incomingCanonical)) return true;

  const aliasCanonicals = new Set(lift.exerciseNameAliases.map((x) => canonicaliseLiftAlias(x)));
  return aliasCanonicals.has(incomingCanonical);
}

/**
 * Resolve headline numbers (True 1RM / Training max) from profile.
 *
 * Older data may be keyed by exercise_name.
 * Newer data may be keyed by canonical exercise_id.
 * This checks all reasonable variants.
 */
export function resolveProfileLift(profile: StrengthProfile | undefined, lift: LiftDef) {
  let true1rm: number | null = null;
  let trainingMax: number | null = null;

  if (!profile) {
    return { true1rm, trainingMax };
  }

  const trueMap = profile.true_1rms || {};
  const tmMap = profile.training_maxes || {};

  const candidateKeys = new Set<string>();

  candidateKeys.add(lift.key);

  for (const id of lift.exerciseIds) {
    candidateKeys.add(id);
    candidateKeys.add(normaliseName(id));
    candidateKeys.add(canonicaliseLiftAlias(id));
  }

  for (const alias of lift.exerciseNameAliases) {
    candidateKeys.add(alias);
    candidateKeys.add(normaliseName(alias));
    candidateKeys.add(canonicaliseLiftAlias(alias));
  }

  for (const key of candidateKeys) {
    const v = trueMap[key];
    if (typeof v === "number") {
      true1rm = v;
      break;
    }
  }

  for (const key of candidateKeys) {
    const v = tmMap[key];
    if (typeof v === "number") {
      trainingMax = v;
      break;
    }
  }

  return { true1rm, trainingMax };
}
