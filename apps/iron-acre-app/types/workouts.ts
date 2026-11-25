
// types/workouts.ts

// Visibility of a workout template
export type Visibility = 'global' | 'private';

// Allowed kettlebell structures
export type KBStyle = 'EMOM' | 'AMRAP' | 'LADDER';

/** One atomic boxing action inside a combo (variable length) */
export type BoxingAction = {
  kind: 'punch' | 'defence';   // domain: punches & defensive actions
  code: string;                // e.g. 'jab', 'cross', 'hook', 'uppercut', 'slip', 'roll', 'parry'
  count?: number;              // e.g. double jab = { kind:'punch', code:'jab', count:2 }
  tempo?: string;              // optional tempo notation (e.g., 'fast', '3-1-1')
  notes?: string;              // optional action-level notes
};

/** One combo = ordered array of actions; optional display name */
export type BoxingCombo = {
  name?: string;               // optional display title e.g. "Jab, Cross, Slip"
  actions: BoxingAction[];     // required; at least 1 action
  notes?: string;              // optional combo-level notes
};

/** One boxing round: exactly 3 combos; implicitly 3 minutes (180s) */
export type BoxingRoundInput = {
  name?: string;               // defaults to "Boxing Round {n}"
  combos: [BoxingCombo, BoxingCombo, BoxingCombo]; // exactly 3 combos
};

/** Prescription for a kettlebell exercise within a round */
export type KBExerciseItem = {
  exercise_id: string;         // must exist in global exercises collection
  order: number;               // display/logging order within the round
  reps?: string;               // e.g., "10", "10-8-6", "1-2-3-4-5"
  time_s?: number;             // EMOM or timed work (seconds)
  weight_kg?: number;          // prescribed weight
  style?: KBStyle;             // optional per-item override (else inherit round style)
  tempo?: string;              // optional tempo notation
  rest_s?: number;             // optional per-item rest
  notes?: string;              // optional item notes
};

/** One kettlebell round with at least one item */
export type KBRoundInput = {
  name?: string;               // defaults to "Kettlebells Round {n}"
  style: KBStyle;              // EMOM | AMRAP | LADDER
  order?: number;              // normalised server-side
  items: KBExerciseItem[];     // at least 1 item
  is_benchmark_component?: boolean; // whether this round counts toward benchmark tally
};

/** Payload your client POSTs to create a workout template */
export type WorkoutCreatePayload = {
  visibility: Visibility;      // global (everyone) or private (owner only)
  owner_email?: string;        // required if visibility='private'
  workout_id?: string;         // optional explicit ID (else auto)
  workout_name: string;
  focus?: string;
  notes?: string;
  video_url?: string;
  is_benchmark?: boolean;      // template-level benchmark flag
  benchmark_name?: string;     // optional benchmark label
  boxing: { rounds: BoxingRoundInput[] };    // must be exactly 5 rounds
  kettlebell: { rounds: KBRoundInput[] };    // must be exactly 5 rounds
  dry_run?: boolean;           // when true, validate only (no writes)
};

/** Normalised item returned by APIs after writes/hydration */
export type ExerciseItemOut = {
  item_id: string;             // Firestore doc id
  type: 'Boxing' | 'Kettlebell';
  style: KBStyle | 'Combo';    // 'Combo' for boxing; KBStyle for kettlebells
  order: number;

  // Boxing-specific
  duration_s?: number;         // boxing combo duration (mirrors round 180s)
  combo?: {
    name?: string;
    actions: BoxingAction[];
    notes?: string;
  };

  // Kettlebell-specific
  exercise_id?: string;
  reps?: string;
  time_s?: number;
  weight_kg?: number;
  tempo?: string;
  rest_s?: number;
};

/** Round DTO returned by create/get APIs */
export type RoundOut = {
  round_id: string;            // Firestore doc id
  name: string;
  order: number;
  category: 'Boxing' | 'Kettlebell';
  style?: KBStyle;             // kettlebell rounds only
  duration_s?: number;         // boxing rounds = 180
  is_benchmark_component?: boolean;
  items: ExerciseItemOut[];
};

/** Full workout template DTO returned by APIs */
export type WorkoutTemplateDTO = {
  workout_id: string;
  visibility: Visibility;
  owner_email?: string;
  workout_name: string;
  focus?: string;
  notes?: string;
  video_url?: string;
  is_benchmark?: boolean;
  benchmark_name?: string;
  created_at: string;          // ISO string
  updated_at: string;          // ISO string
  rounds: RoundOut[];          // ordered: boxing 1..5, kettlebell 6..10
};
