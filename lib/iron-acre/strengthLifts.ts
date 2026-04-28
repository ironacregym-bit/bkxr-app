// lib/iron-acre/strengthLifts.ts

export type StrengthProfile = {
  training_maxes?: Record<string, number>;
  true_1rms?: Record<string, number>;
  rounding_increment_kg?: number;
  updated_at?: any;
};

export type LiftDef = {
  key: string;
  label: string;
  exerciseNames: string[]; // exact names used in strength_profiles + completion sets.exercise_id
};

export const BIG_LIFTS: LiftDef[] = [
  {
    key: "deadlift",
    label: "Deadlift",
    exerciseNames: ["Deadlift", "Barbell Deadlift"],
  },
  {
    key: "back_squat",
    label: "Back Squat",
    exerciseNames: ["Back Squat", "Barbell Back Squat"],
  },
  {
    key: "bench_press",
    label: "Bench Press",
    exerciseNames: ["Barbell Bench Press", "Bench Press"],
  },
  {
    key: "overhead_press",
    label: "Overhead Press",
    exerciseNames: ["Overhead Press", "Barbell Overhead Press", "Strict Press"],
  },
];

export function getLiftDef(liftKey: string): LiftDef | undefined {
  return BIG_LIFTS.find((l) => l.key === liftKey);
}

export function resolveProfileLift(profile: StrengthProfile | undefined, lift: LiftDef) {
  let true1rm: number | null = null;
  let trainingMax: number | null = null;

  if (!profile) return { true1rm, trainingMax };

  for (const name of lift.exerciseNames) {
    const v = profile.true_1rms?.[name];
    if (typeof v === "number") {
      true1rm = v;
      break;
    }
  }

  for (const name of lift.exerciseNames) {
    const v = profile.training_maxes?.[name];
    if (typeof v === "number") {
      trainingMax = v;
      break;
    }
  }

  return { true1rm, trainingMax };
}

export function normaliseName(s: string) {
  return String(s || "").trim().toLowerCase();
}
