// lib/iron-acre/strengthLifts.ts?: number | null;
};

export type LiftDef = {
  key: string; // route key: deadlift | back_squat | bench_press | overhead_press
  label: string; // display label
  // Canonical IDs in strength_exercises (underscore doc ids)
  exerciseIds: string[];
  // Display-name aliases that may exist in old completions / old profile maps
  exerciseNameAliases: string[];
};

// IMPORTANT: set the deadlift doc id once you confirm it exists in strength_exercises
// Common candidates: "barbell_deadlift", "barbell_conventional_deadlift"
const DEADLIFT_IDS = ["barbell_deadlift"];

export const BIG_LIFTS: LiftDef[] = [
  {
    key: "deadlift",
    label: "Deadlift",
    exerciseIds: DEADLIFT_IDS,
    exerciseNameAliases: ["Deadlift", "Barbell Deadlift"],
  },
  {
    key: "back_squat",
    label: "Back Squat",
    exerciseIds: ["barbell_back_squat"],
    exerciseNameAliases: ["Back Squat", "Barbell Back Squat"],
  },
  {
    key: "bench_press",
    label: "Bench Press",
    exerciseIds: ["barbell_flat_bench_press"],
    exerciseNameAliases: ["Barbell Bench Press", "Bench Press", "Barbell Flat Bench Press"],
  },
  {
    key: "overhead_press",
    label: "Overhead Press",
    exerciseIds: ["barbell_strict_press"],
    exerciseNameAliases: ["Overhead Press", "Barbell Overhead Press", "Strict Press", "Barbell Strict Press"],
  },
];

export function getLiftDef(liftKey: string): LiftDef | undefined {
  return BIG_LIFTS.find((l) => l.key === liftKey);
}

export function normaliseName(s: string) {
  return String(s || "").trim().toLowerCase();
}

/**
 * Match completion set.exercise_id against this lift.
 * Supports:
 * - canonical underscore IDs (preferred)
 * - legacy stored names (fallback)
 */
export function matchesLiftExerciseId(exerciseIdFromCompletion: string, lift: LiftDef) {
  const ex = normaliseName(exerciseIdFromCompletion);
  const idSet = new Set(lift.exerciseIds.map(normaliseName));
  const aliasSet = new Set(lift.exerciseNameAliases.map(normaliseName));
  return idSet.has(ex) || aliasSet.has(ex);
}

/**
 * Resolve current headline numbers (True 1RM / Training max) from profile.
 * Your profile maps are currently keyed by exercise_name (from your API),
 * so we check name aliases first.
 * Later we can migrate profile storage to canonical IDs if you want.
 */
export function resolveProfileLift(profile: StrengthProfile | undefined, lift: LiftDef) {
  let true1rm: number | null = null;
  let trainingMax: number | null = null;

  if (!profile) return { true1rm, trainingMax };

  for (const n of lift.exerciseNameAliases) {
    const v = profile.true_1rms?.[n];
    if (typeof v === "number") {
      true1rm = v;
      break;
    }
  }

  for (const n of lift.exerciseNameAliases) {
    const v = profile.training_maxes?.[n];
    if (typeof v === "number") {
      trainingMax = v;
      break;
    }
  }

  return { true1rm, trainingMax };
}
``

export type StrengthProfile = {
  training_maxes?: Record<string, number>; // may be keyed by exercise_name in older data
  true_1rms?: Record<string, number>; // may be keyed by exercise_name in older data
  rounding_increment_kg?: number;
  updated_at?: any;
};

// Canonical strength exercise record (from Firestore strength_exercises)
export type StrengthExercise = {
  id: string; // doc id e.g. barbell_back_squat
  exercise_name: string; // display name e.g. "Barbell Back Squat"
  tracked?: boolean;
  rounding_kg?: number | null;
  max_rep_for_e1rm?: number | null;
