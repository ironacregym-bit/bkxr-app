
// components/Onboarding/types.ts
export type WorkoutType = "bodyweight" | "kettlebells" | "dumbbells";
export type FightingStyle = "boxing" | "kickboxing";
export type JobType = "desk" | "mixed" | "manual" | "athlete";

export type UsersDoc = {
  email?: string;
  height_cm?: number | null;
  weight_kg?: number | null;
  bodyfat_pct?: number | null;
  DOB?: string | null;
  sex?: "male" | "female" | "other" | null;
  job_type?: JobType | null;
  activity_factor?: number | null;
  calorie_target?: number | null;
  protein_target?: number | null;
  carb_target?: number | null;
  fat_target?: number | null;
  goal_primary?: "lose" | "tone" | "gain" | null;
  workout_type?: WorkoutType | null;
  fighting_style?: FightingStyle | null;
  equipment?: { bodyweight?: boolean; kettlebell?: boolean; dumbbell?: boolean } | null;
  gym_id?: string | null;
  location?: string | null;
  role?: string | null;
  subscription_status?: "trialing" | "active" | "past_due" | "canceled" | "paused" | "incomplete" | null;
  trial_end?: string | null;
}
