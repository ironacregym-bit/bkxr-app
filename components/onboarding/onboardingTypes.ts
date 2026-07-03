// onboardingTypes.ts
export type Sex = "male" | "female" | null;
export type GoalPrimary = "lose" | "tone" | "gain" | null;
export type JobType = "desk" | "mixed" | "manual" | "athlete" | null;
export type UserType = "gym" | "online" | null;

export type MembershipStatus =
  | "gym_member"
  | "online_user"
  | "none"
  | "trial"
  | "cancelled"
  | string
  | null;

export type StepKey = "metrics" | "goal" | "program" | "finish";

export type UsersDoc = {
  email?: string;

  height_cm?: number | null;
  weight_kg?: number | null;
  bodyfat_pct?: number | null;
  DOB?: string | null;
  sex?: Sex;

  job_type?: JobType;
  activity_factor?: number | null;

  caloric_target?: number | null;
  calorie_target?: number | null;
  protein_target?: number | null;
  carb_target?: number | null;
  fat_target?: number | null;

  goal_primary?: GoalPrimary;
  goal_intensity?: string | null;

  workout_type?: string | null;
  program_id?: string | null;
  program_name?: string | null;

  user_type?: UserType;
  membership_status?: MembershipStatus;

  gym_id?: string | null;
  gym_name?: string | null;

  billing_plan?: string | null;
  payment_method_type?: string | null;
  direct_debit_status?: string | null;

  subscription_status?: string | null;
  trial_end?: string | null;
  location?: string | null;
  role?: string | null;

  parq_status?: string | null;
  parq_completed_at?: string | null;

  onboarding_complete?: boolean | null;
  onboarding_started_at?: string | null;
  onboarding_completed_at?: string | null;
};

export type ProgramOption = {
  id: string;
  program_id: string;
  title: string;
  subtitle: string;
  weeks?: number | null;
};

export type GymOption = {
  id: string;
  title: string;
  subtitle: string;
  location?: string | null;
};

export type MacroTargets = {
  caloric_target: number | null;
  protein_target: number | null;
  carb_target: number | null;
  fat_target: number | null;
};
