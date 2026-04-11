export type StrengthSpec = {
  basis_exercise?: string | null;
  percent_1rm?: number | null;
  percent_min?: number | null;
  percent_max?: number | null;
  rounding_kg?: number | null;
  mode?: "straight" | "top_set" | "backoff" | "emom" | "test" | null;
};

export type UISingleItem = {
  type: "Single";
  order: number;
  exercise_id: string;
  exercise_name?: string;
  sets?: number;
  reps?: string;
  weight_kg?: number | null;
  rest_s?: number | null;
  notes?: string | null;
  strength?: StrengthSpec | null;
};

export type UISupersetSubItem = {
  exercise_id: string;
  exercise_name?: string;
  reps?: string;
  weight_kg?: number | null;
};

export type UISupersetItem = {
  type: "Superset";
  order: number;
  name?: string | null;
  items: UISupersetSubItem[];
  sets?: number | null;
  rest_s?: number | null;
  notes?: string | null;
};

export type UIRound = {
  name: string;
  order: number;
  items: Array<UISingleItem | UISupersetItem>;
};

export type GymWorkout = {
  workout_id: string;
  workout_name: string;
  focus?: string;
  notes?: string;
  warmup?: UIRound | null;
  main: UIRound;
  finisher?: UIRound | null;
};

export type CompletionSet = {
  exercise_id: string;
  set: number;
  weight: number | null;
  reps: number | null;
};

export type PreviousCompletion = {
  sets?: CompletionSet[];
  completedAt?: string;
};

export type Completion = {
  id?: string;
  workout_id?: string;
  activity_type?: string | null;
  duration_minutes?: number | null;
  calories_burned?: number | null;
  completed_date?: any;
  date_completed?: any;
};
