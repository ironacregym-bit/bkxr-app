export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type DayName = typeof DAYS[number];

export type StrengthSpec = {
  basis_exercise?: string;
  percent_1rm?: number | null;
  percent_min?: number | null;
  percent_max?: number | null;
  rounding_kg?: number | null;
  mode?: "straight" | "top_set" | "backoff" | "emom" | "test" | null;
};

export type SingleItem = {
  uid: string;
  type: "Single";
  order: number;
  exercise_id: string;
  sets?: number;
  reps?: string;
  weight_kg?: number | null;
  rest_s?: number | null;
  notes?: string | null;
  strength?: StrengthSpec | null;
};

export type SupersetSubItem = {
  uid: string;
  exercise_id: string;
  reps?: string;
  weight_kg?: number | null;
};

export type SupersetItem = {
  uid: string;
  type: "Superset";
  order: number;
  name?: string | null;
  items: SupersetSubItem[];
  sets: number;
  rest_s?: number | null;
  notes?: string | null;
};

export type GymRound = {
  name: string;
  order: number;
  items: Array<SingleItem | SupersetItem>;
};

export type ExerciseRow = { id: string; exercise_name: string; type?: string };

export type QuickTarget =
  | { kind: "single"; round: "warmup" | "main" | "finisher"; idx: number }
  | { kind: "superset"; round: "warmup" | "main" | "finisher"; idx: number; subIdx: number };

export type AdminRoundFetch = {
  name: string;
  order: number;
  items?: any[];
};

export type AdminWorkoutFetch = {
  workout_id: string;
  workout_name: string;
  visibility: "global" | "private";
  owner_email?: string;
  focus?: string;
  notes?: string;
  video_url?: string;
  warmup?: AdminRoundFetch | null;
  main?: AdminRoundFetch | null;
  finisher?: AdminRoundFetch | null;
  recurring?: boolean;
  recurring_day?: DayName | string | null;
  recurring_start?: any;
  recurring_end?: any;
  assigned_to?: string | null;
};

export type MetaState = {
  workout_name: string;
  focus: string;
  notes: string;
  video_url: string;
  visibility: "global" | "private";
  recurring: boolean;
  recurring_day: DayName;
  recurring_start: string; // YYYY-MM-DD
  recurring_end: string;   // YYYY-MM-DD
  assigned_to: string;
};

export type QuickFormState = {
  exercise_name: string;
  type: string;
  equipment: string;
  video_url: string;
  met_value: string | number;
  description: string;
};
