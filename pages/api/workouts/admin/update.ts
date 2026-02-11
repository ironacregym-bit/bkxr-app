// pages/api/workouts/admin/update.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

/* ---------- Types (aligned with your create route) ---------- */
type SingleItem = {
  type: "Single";
  order: number;
  exercise_id: string;
  sets?: number;
  reps?: string;
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
  name: string; // "Warm Up" | "Main Set" | "Finisher"
  order: number;
  items: Array<SingleItem | SupersetItem>;
};

type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

type GymUpdatePayload = {
  workout_id: string;
  visibility: "global" | "private";
  owner_email?: string;
  workout_name: string;
  focus?: string;
  notes?: string;
  video_url?: string;

  warmup?: GymRound | null;
  main: GymRound;
  finisher?: GymRound | null;

  recurring?: boolean;
  recurring_day?: DayName | null;
  recurring_start?: string | null; // ISO or parseable
  recurring_end?: string | null;   // ISO or parseable
  assigned_to?: string | string[] | null; // accept single/multiple; normalised to string[]
};

/* ---------- Helpers (same behaviour as create) ---------- */
const ALLOWED_DAYS: DayName[] = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

function isEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}

function parseDateToTimestamp(s: string | null | undefined): Timestamp | null {
  if (!s) return null;
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  // Normalise to midday to avoid TZ-midnight drift
  dt.setHours(12, 0, 0, 0);
  return Timestamp.fromDate(dt);
}

/** Normalise assigned_to into a clean string[] (lowercased, unique). */
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
    const parts = input
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(parts.filter(isEmail)));
  }
  return [];
}

/** Chunked batch helpers to avoid Firestore's 500-op limit */
async function commitDeletesInChunks(refs: FirebaseFirestore.DocumentReference[]) {
  const db = firestore;
  const CHUNK = 400;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const slice = refs.slice(i, i + CHUNK);
    const batch = db.batch();
    slice.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function commitSetsInChunks(
  sets: { ref: FirebaseFirestore.DocumentReference; data: FirebaseFirestore.DocumentData }[]
) {
  const db = firestore;
  const CHUNK = 400;
  for (let i = 0; i < sets.length; i += CHUNK) {
    const slice = sets.slice(i, i + CHUNK);
    const batch = db.batch();
    slice.forEach(({ ref, data }) => batch.set(ref, data));
    await batch.commit();
  }
}

/* ---------- Handler ---------- */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const p = req.body as GymUpdatePayload;

  // Basic validations
  if (!p.workout_id || typeof p.workout_id !== "string") {
    return res.status(400).json({ error: "workout_id is required" });
  }
  if (!p.workout_name || !p.visibility) {
    return res.status(400).json({ error: "workout_name and visibility are required" });
  }
  if (p.visibility === "private" && !p.owner_email) {
    return res.status(400).json({ error: "owner_email is required for private workouts" });
  }
  if (!p.main || !Array.isArray(p.main.items) || p.main.items.length === 0) {
    return res.status(400).json({ error: "main must include at least one item" });
  }

  // Recurrence validations (mirror create)
  const isRecurring = !!p.recurring;
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
    const id = decodeURIComponent(p.workout_id);
    const workoutRef = db.collection("workouts").doc(id);

    // Require existence for edit
    const snap = await workoutRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Workout not found" });
    }

    const now = Timestamp.now();

    // Update top-level doc (merge; keep created_at, workout_type, etc.)
    const topLevelUpdate = {
      workout_name: p.workout_name,
      focus: p.focus ?? null,
      notes: p.notes ?? null,
      video_url: p.video_url ?? null,
      visibility: p.visibility,
      owner_email: p.visibility === "private" ? (p.owner_email || null) : null,
      updated_at: now,

      // Recurrence fields
      recurring: isRecurring,
      recurring_day: isRecurring ? dayName : null,
      recurring_start: isRecurring ? tsStart : null,
      recurring_end: isRecurring ? tsEnd : null,

      // Always array form (empty [] if not provided)
      assigned_to: assignedToList,
    };

    await workoutRef.set(topLevelUpdate, { merge: true });

    // Rebuild rounds subcollection
    // 1) Gather existing round + item refs
    const roundsSnap = await workoutRef.collection("rounds").get();
    const deleteRefs: FirebaseFirestore.DocumentReference[] = [];
    for (const rd of roundsSnap.docs) {
      const itemsSnap = await rd.ref.collection("items").get();
      itemsSnap.docs.forEach((it) => deleteRefs.push(it.ref));
      deleteRefs.push(rd.ref);
    }
    if (deleteRefs.length) await commitDeletesInChunks(deleteRefs);

    // 2) Build new rounds array in the persisted order (same as create)
    const newRounds: GymRound[] = [];
    if (p.warmup) newRounds.push({ ...p.warmup, order: 1 });
    newRounds.push({ ...p.main, order: p.warmup ? 2 : 1 });
    if (p.finisher) newRounds.push({ ...p.finisher, order: p.warmup ? 3 : (p.main ? 2 : 1) });

    // 3) Prepare sets for rounds/items and commit in chunks
    const sets: { ref: FirebaseFirestore.DocumentReference; data: FirebaseFirestore.DocumentData }[] = [];

    for (const r of newRounds) {
      const roundRef = workoutRef.collection("rounds").doc();
      sets.push({
        ref: roundRef,
        data: {
          name: r.name,
          order: r.order,
          category: "Gym",
          duration_s: null,
          style: null,
          is_benchmark_component: false,
        },
      });

      const sorted = [...(r.items || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
      for (const it of sorted) {
        const itemRef = roundRef.collection("items").doc();
        if (it.type === "Single") {
          const s = it as SingleItem;
          sets.push({
            ref: itemRef,
            data: {
              type: "Single",
              order: s.order,
              exercise_id: s.exercise_id,
              sets: s.sets ?? null,
              reps: s.reps ?? null,
              weight_kg: s.weight_kg ?? null,
              rest_s: s.rest_s ?? null,
              notes: s.notes ?? null,
            },
          });
        } else {
          const ss = it as SupersetItem;
          sets.push({
            ref: itemRef,
            data: {
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
            },
          });
        }
      }
    }

    if (sets.length) await commitSetsInChunks(sets);

    return res.status(200).json({ ok: true, workout_id: id });
  } catch (err: any) {
    console.error("[workouts/admin/update] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to update gym workout" });
  }
}
