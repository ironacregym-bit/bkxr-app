// components/gym-create/GymCreateWorkout.constants.ts

import type { StrengthSpec } from "./StrengthPrescriptionEditor";

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type DayName = (typeof DAYS)[number];

export const mkUid = () => {
  try {
    // @ts-ignore
    return crypto?.randomUUID ? crypto.randomUUID() : `uid_${Math.random().toString(36).slice(2)}`;
  } catch {
    return `uid_${Math.random().toString(36).slice(2)}`;
  }
};

// Accepts Firestore Timestamp-like, Date, number(ms), or string → returns "YYYY-MM-DD" or ""
export function toYMD(input: any): string {
  if (!input) return "";
  try {
    if (typeof input === "string") {
      const s = input.trim();
      if (s.length >= 10 && /\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      const d = new Date(s);
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    if (typeof input === "object" && input !== null && typeof (input as any).seconds === "number") {
      const ts = input as { seconds: number; nanoseconds?: number };
      const ms = ts.seconds * 1000 + (ts.nanoseconds ? ts.nanoseconds / 1e6 : 0);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    if (input instanceof Date) return isNaN(input.getTime()) ? "" : input.toISOString().slice(0, 10);
    if (typeof input === "number") {
      const d = new Date(input);
      return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    const s = String(input);
    if (/\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export type ExerciseRow = { id: string; exercise_name: string; type?: string };

export type StrengthExercisesResp = {
  ok?: boolean;
  names?: string[];
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
  strength?: StrengthSpec | null;
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

export type QuickTarget =
  | { kind: "single"; round: "warmup" | "main" | "finisher"; idx: number }
  | { kind: "superset"; round: "warmup" | "main" | "finisher"; idx: number; subIdx: number };

export type AdminRoundFetch = { name: string; order: number; items?: any[] };

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

export function renumber<T extends { order: number }>(items: T[]): T[] {
  return items.map((it, i) => ({ ...it, order: i + 1 }));
}

export function newSingleItem(): SingleItem {
  return {
    uid: mkUid(),
    type: "Single",
    order: 1,
    exercise_id: "",
    sets: 3,
    reps: "",
    weight_kg: null,
    rest_s: null,
    notes: null,
    strength: null,
  };
}

export function newSupersetSubItem(): SupersetSubItem {
  return {
    uid: mkUid(),
    exercise_id: "",
    reps: "",
    weight_kg: null,
    strength: null,
  };
}

export function newSupersetItem(): SupersetItem {
  return {
    uid: mkUid(),
    type: "Superset",
    order: 1,
    name: "",
    items: [newSupersetSubItem(), newSupersetSubItem()],
    sets: 3,
    rest_s: null,
    notes: "",
  };
}

// Normalise admin round payload into UI round shape
export function toUIRound(
  r?: AdminRoundFetch | null,
  fallbackName = "Round",
  fallbackOrder = 1
): GymRound | null {
  if (!r) return null;
  const rawItems: any[] = Array.isArray(r.items) ? r.items : [];

  const uiItems: Array<SingleItem | SupersetItem> = rawItems.map((it: any, idx: number) => {
    const order = Number.isFinite(it?.order) ? it.order : idx + 1;

    if (String(it?.type) === "Superset") {
      const subs: any[] = Array.isArray(it.items)
        ? it.items
        : Array.isArray(it.superset_items)
        ? it.superset_items
        : [];

      const mappedSubs: SupersetSubItem[] = subs.map((s: any) => ({
        uid: mkUid(),
        exercise_id: String(s?.exercise_id || ""),
        reps: typeof s?.reps === "string" ? s.reps : s?.reps != null ? String(s.reps) : "",
        weight_kg: typeof s?.weight_kg === "number" ? s.weight_kg : s?.weight_kg ?? null,
        strength: s?.strength ?? null,
      }));

      return {
        uid: mkUid(),
        type: "Superset",
        order,
        name: (it?.name ?? "") || "",
        items: mappedSubs.length ? mappedSubs : [newSupersetSubItem()],
        sets: Number.isFinite(it?.sets) ? it.sets : 3,
        rest_s: it?.rest_s ?? null,
        notes: it?.notes ?? "",
      };
    }

    return {
      uid: mkUid(),
      type: "Single",
      order,
      exercise_id: String(it?.exercise_id || ""),
      sets: Number.isFinite(it?.sets) ? it.sets : undefined,
      reps: typeof it?.reps === "string" ? it.reps : it?.reps != null ? String(it.reps) : "",
      weight_kg: typeof it?.weight_kg === "number" ? it.weight_kg : it?.weight_kg ?? null,
      rest_s: it?.rest_s ?? null,
      notes: it?.notes ?? null,
      strength: it?.strength ?? null,
    };
  });

  const itemsSorted = [...uiItems].sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0));

  return {
    name: (r?.name || fallbackName) as string,
    order: Number.isFinite(r?.order) ? (r!.order as number) : fallbackOrder,
    items: itemsSorted,
  };
}
