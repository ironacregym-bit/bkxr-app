import type {
  BillingPlan,
  GoalPrimary,
  JobType,
  MacroTargets,
  PaymentMethodType,
  Sex,
  StepKey,
  UsersDoc,
} from "./onboardingTypes";

export const STEPS: Array<{ key: StepKey; title: string; subtitle: string }> = [
  {
    key: "metrics",
    title: "Your metrics",
    subtitle: "We use these to personalise your calories and macros.",
  },
  {
    key: "goal",
    title: "Goal and activity",
    subtitle: "Tell us what you want to achieve and how active you are day to day.",
  },
  {
    key: "programme_access",
    title: "Programme and access",
    subtitle: "Choose your programme and how you’ll use Iron Acre.",
  },
  {
    key: "parq_billing",
    title: "PAR-Q and billing",
    subtitle: "Complete the required setup for gym access and payments.",
  },
  {
    key: "finish",
    title: "Review and finish",
    subtitle: "Check your setup, save it and continue into Iron Acre.",
  },
];

export const ACTIVITY_OPTIONS: Array<{
  job_type: JobType;
  factor: number;
  title: string;
  subtitle: string;
}> = [
  {
    job_type: "desk",
    factor: 1.2,
    title: "Low activity",
    subtitle: "Mostly desk-based, low movement through the day.",
  },
  {
    job_type: "mixed",
    factor: 1.375,
    title: "Light activity",
    subtitle: "A mix of desk work and general movement.",
  },
  {
    job_type: "manual",
    factor: 1.55,
    title: "Moderate activity",
    subtitle: "On your feet often, manual work or physically active job.",
  },
  {
    job_type: "athlete",
    factor: 1.9,
    title: "High activity",
    subtitle: "Very active daily routine, physical work and/or lots of training.",
  },
];

export const ONBOARDING_FIELD_KEYS: Array<keyof UsersDoc> = [
  "sex",
  "DOB",
  "height_cm",
  "weight_kg",
  "bodyfat_pct",
  "job_type",
  "activity_factor",
  "goal_primary",
  "program_id",
  "program_name",
  "workout_type",
  "user_type",
  "membership_status",
  "gym_id",
  "gym_name",
  "billing_plan",
  "payment_method_type",
  "direct_debit_status",
  "direct_debit_provider",
  "direct_debit_setup_url",
  "parq_status",
  "parq_completed_at",
];

export function stepIndex(key: StepKey) {
  return STEPS.findIndex((s) => s.key === key);
}

export function isValidDob(value: string | null | undefined) {
  const v = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return false;
  }

  const d = new Date(`${v}T00:00:00`);

  if (isNaN(d.getTime())) {
    return false;
  }

  const now = new Date();

  if (d > now) {
    return false;
  }

  return true;
}

export function calculateAge(dob: string | null | undefined) {
  const v = String(dob || "").trim();

  if (!isValidDob(v)) {
    return 30;
  }

  const birth = new Date(`${v}T00:00:00`);
  const now = new Date();

  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

export function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return String(Math.round(value));
}

export function getJobTypeFromActivityFactor(
  activityFactor: number | null | undefined
): JobType {
  const af = Number(activityFactor ?? 1.2);

  if (Math.abs(af - 1.2) < 0.01) return "desk";
  if (Math.abs(af - 1.375) < 0.01) return "mixed";
  if (Math.abs(af - 1.55) < 0.01) return "manual";
  if (Math.abs(af - 1.9) < 0.01) return "athlete";

  return null;
}

export function calculateTargets(profile: UsersDoc, age: number): MacroTargets {
  const weight = Number(profile.weight_kg ?? 0);
  const height = Number(profile.height_cm ?? 0);
  const bodyFat = Number(profile.bodyfat_pct ?? 0);
  const af = Number(profile.activity_factor ?? 1.2);
  const sex = profile.sex ;
  const goal: GoalPrimary = profile.goal_primary ?? null;

  if (!(weight > 0 && height > 0 && af > 0) || !goal) {
    return {
      caloric_target: null,
      protein_target: null,
      carb_target: null,
      fat_target: null,
    };
  }

  const leanMass =
    bodyFat > 0 && bodyFat < 70 ? weight * (1 - bodyFat / 100) : null;

  const bmr =
    sex === "male"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : sex === "female"
      ? 10 * weight + 6.25 * height - 5 * age - 161
      : 10 * weight + 6.25 * height - 5 * age;

  let tdee = bmr * af;

  if (goal === "lose") {
    tdee *= 0.85;
  }

  if (goal === "tone") {
    tdee *= 1.0;
  }

  if (goal === "gain") {
    tdee *= 1.1;
  }

  const proteinBase = leanMass && leanMass > 0 ? leanMass : weight;
  const proteinMultiplier =
    goal === "lose" ? 2.1 : goal === "gain" ? 1.9 : 1.8;

  const proteinG = Math.max(90, Math.round proteinBase * proteinMultiplier);
  const fatG = Math.round(Math.min(120, Math.max(45, 0.8 * weight)));
  const kcalAfterProteinAndFat = tdee - (proteinG * 4 + fatG * 9);
  const carbsG = Math.max(0, Math.round(kcalAfterProteinAndFat / 4));

  return {
    caloric_target: Math.round(tdee),
    protein_target: proteinG,
    carb_target: carbsG,
    fat_target: fatG,
  };
}

export function goalLabel(goal: GoalPrimary) {
  if (goal === "lose") return "Lose weight";
  if (goal === "tone") return "Maintain / tone";
  if (goal === "gain") return "Gain muscle";

  return "—";
}

export function accessLabel(profile: UsersDoc) {
  if (profile.user_type === "gym") {
    return profile.gym_name || "Gym member";
  }

  if (profile.user_type === "online") {
    return "Online user";
  }

  return "—";
}

export function billingLabel(profile: UsersDoc) {
  const billingPlan = profile.billing_plan as BillingPlan;
  const paymentType = profile.payment_method_type as PaymentMethodType;

  if (billingPlan === "gym_monthly" && paymentType === "direct_debit") {
    return "Gym monthly • Direct Debit";
  }

  if (billingPlan === "online_monthly" && paymentType === "stripe") {
    return "Online monthly • Stripe";
  }

  if (billingPlan === "pay_as_you_go" && paymentType === "cash") {
    return "Pay as you go • Cash on day";
  }

  if (billingPlan === "pay_in_advance" && paymentType === "advance") {
    return "Paid in advance";
  }

  if (billingPlan === "founders") {
    return "Founders membership";
  }

  return "—";
}
