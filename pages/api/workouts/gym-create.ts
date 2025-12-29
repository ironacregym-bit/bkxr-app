
// pages/api/workouts/gym-create.ts
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
  name: string;                         // e.g., "Warm Up", "Main Set", "Finisher"
  order: number;
  items: Array<SingleItem | SupersetItem>;
};

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
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const p = req.body as GymCreatePayload;
  if (!p.workout_name || !p.visibility) {
    return res.status(400).json({ error: "workout_name and visibility are required" });
  }
  if (p.visibility === "private" && !p.owner_email) {
    return res.status(400).json({ error: "owner_email is required for private workouts" });
  }
  if (!p.main || !Array.isArray(p.main.items) || p.main.items.length === 0) {
    return res.status(400).json({ error: "main must include at least one item" });
  }

  try {
    const db = firestore;
    const workoutRef = db.collection("workouts").doc();
    const now = Timestamp.now();
    const batch = db.batch();

    // Base workout doc
    batch.set(
      workoutRef,
      {
        workout_name: p.workout_name,
        focus: p.focus ?? null,
        notes: p.notes ?? null,
        video_url: p.video_url ?? null,
        visibility: p.visibility,
        owner_email: p.visibility === "private" ? p.owner_email : null,
        is_benchmark: false,
        benchmark_name: null,
        workout_type: "gym_custom",       // helpful discriminator
        created_at: now,
        updated_at: now,
      },
      { merge: true }
    );

    const rounds: GymRound[] = [];
    if (p.warmup) rounds.push({ ...p.warmup, order: 1 });
    rounds.push({ ...p.main, order: p.warmup ? 2 : 1 });
    if (p.finisher) rounds.push({ ...p.finisher, order: p.warmup ? 3 : p.main ? 2 : 1 });

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

      // sort by order and write items
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
