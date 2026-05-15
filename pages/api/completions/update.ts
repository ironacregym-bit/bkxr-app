// File: pages/api/completions/update.ts

import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { Timestamp, FieldValue } from "@google-cloud/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { processStrengthFromCompletion } from "../../../lib/strength/processStrengthFromCompletion";

type GymCompletionSet = {
  exercise_id: string;
  set: number;
  weight: number | null;
  reps: number | null;
  movement_key?: string | null;
};

function toNumberOrNull(x: any): number | null {
  if (x == null) return null;
  if (typeof x === "string" && x.trim() === "") return null;

  const n = Number(x);
  if (!Number.isFinite(n)) return null;

  // For weight/reps, 0 is not meaningful
  if (n === 0) return null;

  return n;
}

function toStringOrNull(x: any): string | null {
  if (x == null) return null;
  const s = String(x).trim();
  return s ? s : null;
}

function mapDifficultyToRPE(v: any): number | null {
  if (!v) return null;
  const s = String(v).toLowerCase();
  if (s === "easy") return 4;
  if (s === "medium") return 6;
  if (s === "hard") return 8;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Not signed in" });
    const user_email = session.user.email.toLowerCase();

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const completion_id = String(body.completion_id || body.id || "").trim();
    if (!completion_id) return res.status(400).json({ error: "completion_id required" });

    const docRef = firestore.collection("workoutCompletions").doc(completion_id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Completion not found" });

    const existing = snap.data() as any;
    if (String(existing?.user_email || "").toLowerCase() !== user_email) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Build updated sets (same shape as create)
    const incomingSets: any[] = Array.isArray(body.sets) ? body.sets : [];
    const gymSets: GymCompletionSet[] = incomingSets
      .map((s: any): GymCompletionSet => ({
        exercise_id: String(s?.exercise_id || "").trim(),
        set: Number(s?.set || 0),
        weight: toNumberOrNull(s?.weight),
        reps: toNumberOrNull(s?.reps),
        movement_key: toStringOrNull(s?.movement_key),
      }))
      .filter((s) => s.exercise_id && Number.isFinite(s.set) && s.set > 0);

    // Summary fields
    const calories_burned = toNumberOrNull(body.calories_burned);
    const duration_minutes =
      body.duration_minutes != null
        ? toNumberOrNull(body.duration_minutes)
        : body.duration != null
        ? toNumberOrNull(body.duration)
        : null;

    const activity_type =
      typeof body.activity_type === "string" && body.activity_type.trim() !== ""
        ? body.activity_type.trim()
        : existing?.activity_type
        ? String(existing.activity_type)
        : "Strength training";

    const rpe =
      body.rpe != null && Number.isFinite(Number(body.rpe))
        ? Number(body.rpe)
        : mapDifficultyToRPE(body.difficulty);

    const notes = typeof body.notes === "string" ? body.notes : null;

    let weight_completed_with: number | string | null = null;
    if (body.weight_completed_with != null) {
      if (typeof body.weight_completed_with === "string" && body.weight_completed_with.trim() === "") {
        weight_completed_with = null;
      } else {
        const asNum = Number(body.weight_completed_with);
        weight_completed_with = Number.isFinite(asNum) ? asNum : String(body.weight_completed_with);
      }
    }

    // Optional: keep completed_date stable by default; allow override if provided
    const now = new Date();
    const completedDateTS =
      body.completed_at != null ? Timestamp.fromDate(new Date(body.completed_at)) : (existing?.completed_date ?? Timestamp.fromDate(now));

    const patch: Record<string, any> = {
      updated_at: Timestamp.fromDate(now),

      // Keep these stable but allow overwrite if caller sends them
      workout_id: typeof body.workout_id === "string" && body.workout_id.trim() ? body.workout_id.trim() : existing?.workout_id ?? null,
      activity_type,

      completed_date: completedDateTS,
      date_completed: completedDateTS, // legacy field

      // gym details
      sets: gymSets,

      // summary
      calories_burned: calories_burned ?? null,
      duration_minutes: duration_minutes ?? null,
      rpe: rpe ?? null,
      notes: notes ?? null,
      weight_completed_with: weight_completed_with ?? null,

      // ✅ Force strength reprocessing on edit
      processed_strength_version: FieldValue.delete(),
      processed_strength_at: FieldValue.delete(),
      processed_strength_source_updated_at: FieldValue.delete(),
    };

    await docRef.set(patch, { merge: true });

    // Re-run strength processing for this completion
    try {
      await processStrengthFromCompletion({ completionId: completion_id, userEmail: user_email });
    } catch (e) {
      console.error("[strength/process:update] error:", (e as any)?.message || e);
      // do not fail update if strength processing fails
    }

    return res.status(200).json({ ok: true, id: completion_id });
  } catch (err: any) {
    console.error("[completions/update] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to update completion" });
  }
}
