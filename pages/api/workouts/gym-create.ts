import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

type SingleItem = {
  type: "Single";
  order: number;
  exercise_id: string;
  sets?: number;
  reps?: string;         // e.g., "10" or "10-8-6"
  weight_kg?: number | null;
  rest_s?: number | null;
  notes?: string | null;
};

type SupersetItem = {
  type: "Superset";
  order: number;
  name?: string | null;
  items: Array<{
    exercise_id: string;
    reps?: string;
    weight_kg?: number | null;
  }>;
  sets?: number | null;
  rest_s?: number | null;
  notes?: string | null;
};

type GymRound = {
  name: string; // e.g., "Warm Up", "Main Set", "Finisher"
  order: number;
  items: Array<SingleItem | SupersetItem>;
};

type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

/** Payload now supports string | string[] for assigned_to (normalised to string[]). */
type GymCreatePayload = {
  visibility: "global" | "private";
  owner_email?: string;
  workout_name: string;
  focus?: string;
  notes?: string;
  video_url?: string;
  warmup?: GymRound | null;
  main: GymRound;
  finisher?: GymRound | null;

  // Recurrence & assignment
  recurring?: boolean;
  recurring_day?: DayName | null;
  recurring_start?: string | null; // ISO or parseable date string
  recurring_end?: string | null;   // ISO or parseable date string
  assigned_to?: string | string[] | null; // CHANGED: accept single/multiple; API will normalise to string[]
};

const ALLOWED_DAYS: DayName[] = [
  "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"
];

function isEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}

function parseDateToTimestamp(s: string | null | undefined): Timestamp | null {
  if (!s) return null;
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  // Normalise hour to avoid TZ-midnight drift
  dt.setHours(12, 0, 0, 0);
  return Timestamp.fromDate(dt);
}

/** NEW: normalise assigned_to into a clean string[] (lowercased, unique). */
function normaliseAssignedTo(input: string | string[] | null | undefined): string[] {
  if (Array.isArray(input)) {
    return Array.from(
      new Set(
        input
          .map((e) => String(e || "").trim().toLowerCase())
          .filter((e) => e && isEmail(e))
      )
    );
  }
  if (typeof input === "string") {
    // accept comma/semicolon/space separated lists
    const parts = input
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(parts.filter(isEmail)));
  }
  return [];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const p = req.body as GymCreatePayload;

  // ----- Basic validations (existing) -----
  if (!p.workout_name || !p.visibility) {
    return res.status(400).json({ error: "workout_name and visibility are required" });
  }
  if (p.visibility === "private" && !p.owner_email) {
    return res.status(400).json({ error: "owner_email is required for private workouts" });
  }
  if (!p.main || !Array.isArray(p.main.items) || p.main.items.length === 0) {
    return res.status(400).json({ error: "main must include at least one item" });
  }

  // ----- Recurrence validations (updated) -----
  const isRecurring = !!p.recurring;

  // Normalise assigned_to to array for consistent downstream usage
  const assignedToList = normaliseAssignedTo(p.assigned_to);

  let dayName: DayName | null = null;
  let tsStart: Timestamp | null = null;
  let tsEnd: Timestamp | null = null;

  if (isRecurring) {
    if (!assignedToList.length) {
      return res.status(400).json({ error: "assigned_to must include at least one valid email when recurring is true" });
    }

    const rd = (p.recurring_day || "").trim() as DayName;
    if (!ALLOWED_DAYS.includes(rd)) {
      return res.status(400).json({ error: "recurring_day must be one of Monday–Sunday when recurring is true" });
    }
    dayName = rd;

    tsStart = parseDateToTimestamp(p.recurring_start || null);
    tsEnd = parseDateToTimestamp(p.recurring_end || null);
    if (!tsStart || !tsEnd) {
      return res.status(400).json({ error: "recurring_start and recurring_end must be valid dates when recurring is true" });
    }
    if (tsStart.toDate().getTime() > tsEnd.toDate().getTime()) {
      return res.status(400).json({ error: "recurring_start must be on or before recurring_end" });
    }
  }

  try {
    const db = firestore;
    const workoutRef = db.collection("workouts").doc();
    const now = Timestamp.now();
    const batch = db.batch();

    // Base workout doc (add workout_id mirror + recurring fields)
    batch.set(
      workoutRef,
      {
        workout_id: workoutRef.id,
        workout_name: p.workout_name,
        focus: p.focus ?? null,
        notes: p.notes ?? null,
        video_url: p.video_url ?? null,
        visibility: p.visibility,
        owner_email: p.visibility === "private" ? (p.owner_email || null) : null,
        is_benchmark: false,
        benchmark_name: null,
        workout_type: "gym_custom", // helpful discriminator
        created_at: now,
        updated_at: now,

        // Recurring fields
        recurring: isRecurring,
        recurring_day: isRecurring ? dayName : null,
        recurring_start: isRecurring ? tsStart : null,
        recurring_end: isRecurring ? tsEnd : null,

        // CHANGED: store as array always (empty [] if not provided)
        assigned_to: assignedToList, // array form for legacy/overview compatibility
      },
      { merge: true }
    );

    // Build rounds array in the persisted order
    const rounds: GymRound[] = [];
    if (p.warmup) rounds.push({ ...p.warmup, order: 1 });
    rounds.push({ ...p.main, order: p.warmup ? 2 : 1 });
    if (p.finisher) rounds.push({ ...p.finisher, order: p.warmup ? 3 : (p.main ? 2 : 1) });

    // Persist rounds/items
    for (const r of rounds) {
      const roundRef = workoutRef.collection("rounds").doc();
      batch.set(roundRef, {
        name: r.name,
        order: r.order,
        category: "Gym",
        duration_s: null,
        style: null,
        is_benchmark_component: false,
      });

      const sorted = [...r.items].sort((a, b) => a.order - b.order);
      for (const it of sorted) {
        const itemRef = roundRef.collection("items").doc();
        if (it.type === "Single") {
          const s = it as SingleItem;
          batch.set(itemRef, {
            type: "Single",
            order: s.order,
            exercise_id: s.exercise_id,
            sets: s.sets ?? null,
            reps: s.reps ?? null,
            weight_kg: s.weight_kg ?? null,
            rest_s: s.rest_s ?? null,
            notes: s.notes ?? null,
          });
        } else {
          const ss = it as SupersetItem;
          batch.set(itemRef, {
            type: "Superset",
            order: ss.order,
            name: ss.name ?? null,
            sets: ss.sets ?? null,
            rest_s: ss.rest_s ?? null,
            notes: ss.notes ?? null,
            superset_items: (Array.isArray(ss.items) ? ss.items : []).map((x) => ({
              exercise_id: x.exercise_id,
              reps: x.reps ?? null,
              weight_kg: x.weight_kg ?? null,
            })),
          });
        }
      }
    }

    await batch.commit();

    return res.status(201).json({ ok: true, workout_id: workoutRef.id });
  } catch (err: any) {
    console.error("[workouts/gym-create] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to create gym workout" });
  }
}
