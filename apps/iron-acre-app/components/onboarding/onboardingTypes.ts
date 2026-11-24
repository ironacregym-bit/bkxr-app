export type Sex = "male" | "female" | "other" | null;
export type GoalPrimary = "lose" | "tone" | "gain" | null;
export type JobType = "desk" | "mixed" | "manual" | "athlete" | null;
export type UserType = "gym" | "online" | null;
export type ProgramStartMode = "today" | "next_monday";

export type MembershipStatus =
  | "gym_member"
  | "online_user"
  | "none"
  | "trial"
  | "cancelled"
  | string
  | null;

export type BillingPlan =
  | "gym_monthly"
  | "online_monthly"
  | "pay_as_you_go"
  | "pay_in_advance"
  | "founders"
  | null;

export type PaymentMethodType =
  | "stripe"
  | "direct_debit"
  | "cash"
  | "advance"
  | null;

export type DirectDebitStatus =
  | "not_started"
  | "pending"
  | "active"
  | "failed"
  | null;

export type ParqStatus = "not_started" | "completed" | null;

export type StepKey =
  | "metrics"
  | "goal"
  | "programme_access"
  | "parq_billing"
  | "finish";

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
  program_start_mode?: ProgramStartMode | null;

  user_type?: UserType;
  membership_status?: MembershipStatus;

  gym_id?: string | null;
  gym_name?: string | null;

  billing_plan?: BillingPlan;
  payment_method_type?: PaymentMethodType;

  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  trial_end?: string | null;

  direct_debit_status?: DirectDebitStatus;
  direct_debit_provider?: string | null;
  direct_debit_setup_url?: string | null;

  parq_status?: ParqStatus;
  parq_completed_at?: string | null;

  location?: string | null;
  role?: string | null;

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

export type SetProfile = (updater: (prev: UsersDoc) => UsersDoc) => void;
