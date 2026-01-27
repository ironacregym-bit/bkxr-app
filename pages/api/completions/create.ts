
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

// ---------- Types ----------
type GymCompletionSet = {
  exercise_id: string;
  set: number;
  weight: number | null;
  reps: number | null;
};

type Style = "AMRAP" | "EMOM" | "LADDER" | string;
type PartMetrics = {
  style?: Style;
  rounds_completed?: number | null;
  weight_kg?: number | null;
  notes?: string | null;
};
type PartName = "engine" | "power" | "core" | "ladder" | "load";

// ---------- Handler ----------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Session-derived user (no client-provided email)
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "Not signed in" });
    }
    const user_email = session.user.email.toLowerCase();

    // Body
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const workout_id = String(body.workout_id || "").trim();
    if (!workout_id) {
      return res.status(400).json({ error: "workout_id required" });
    }

    // Manual overrides only (no auto estimates)
    const calories_burned =
      body.calories_burned != null && Number.isFinite(Number(body.calories_burned))
        ? Number(body.calories_burned)
        : null;

    const duration_minutes =
      body.duration_minutes != null && Number.isFinite(Number(body.duration_minutes))
        ? Number(body.duration_minutes)
        : null;

    const activity_type =
      typeof body.activity_type === "string" && body.activity_type.trim() !== ""
        ? body.activity_type.trim()
        : "Strength training";

    const rpe = body.rpe != null ? Number(body.rpe) : null;
    const notes = typeof body.notes === "string" ? body.notes : null;

    const now = new Date();
    const completedDateTS =
      body.completed_at != null
        ? Timestamp.fromDate(new Date(body.completed_at))
        : Timestamp.fromDate(now);

    // Determine mode
    const isGym = Array.isArray(body.sets) && body.sets.length > 0;
    const isBenchmarkLike =
      body.engine || body.power || body.core || body.ladder || body.load || body.is_benchmark;

    // New doc (keep history; do not overwrite)
    const docRef = firestore.collection("workoutCompletions").doc();
    const docId = docRef.id;

    // ---------- GYM COMPLETION ----------
    if (isGym) {
      const sets: GymCompletionSet[] = body.sets
        .map((s: any): GymCompletionSet => ({
          exercise_id: String(s?.exercise_id || "").trim(),
          set: Number(s?.set || 0),
          weight: s?.weight == null ? null : Number(s.weight),
          reps: s?.reps == null ? null : Number(s.reps),
        }))
        .filter((s: GymCompletionSet) => s.exercise_id && s.set > 0);

      const payload = {
        id: docId,
        workout_id,
        user_email,
        completed_date: completedDateTS,
        date_completed: completedDateTS, // legacy field

        activity_type,
        sets,

        // Manual overrides (optional)
        calories_burned,
        duration_minutes,
        rpe,
        notes,

        created_at: Timestamp.fromDate(now),
        updated_at: Timestamp.fromDate(now),
      };

      await docRef.set(payload, { merge: true });
      return res.status(201).json({ ok: true, type: "gym", id: docId });
    }

    // ---------- BXKR / BENCHMARK COMPLETION ----------
    if (isBenchmarkLike) {
      const parts: PartName[] = ["engine", "power", "core", "ladder", "load"];
      const provided: Record<PartName, PartMetrics> = {} as any;

      const normalisePart = (v: any): PartMetrics | undefined => {
        if (!v || typeof v !== "object") return undefined;

        const styleStr = typeof v.style === "string" ? v.style.trim() : undefined;
        const style: Style | undefined =
          styleStr && ["AMRAP", "EMOM", "LADDER"].includes(styleStr.toUpperCase())
            ? styleStr.toUpperCase()
            : styleStr;

        const rounds =
          v.rounds_completed != null && Number.isFinite(Number(v.rounds_completed))
            ? Math.max(0, Math.floor(Number(v.rounds_completed)))
            : undefined;

        const weight =
          v.weight_kg != null && Number.isFinite(Number(v.weight_kg))
            ? Number(v.weight_kg)
            : v.weight_kg === null
            ? null
            : undefined;

        const note = typeof v.notes === "string" ? v.notes : undefined;

        const hasContent = style != null || rounds != null || weight != null || note != null;
        return hasContent ? { style, rounds_completed: rounds, weight_kg: weight, notes: note } : undefined;
      };

      for (const p of parts) {
        const norm = normalisePart(body[p]);
        if (norm) provided[p] = norm;
      }

      const payload: any = {
        id: docId,
        workout_id,
        user_email,
        completed_date: completedDateTS,
        date_completed: completedDateTS,

        // Manual overrides (optional)
        calories_burned: calories_burned ?? null,
        duration: duration_minutes ?? null, // <- keep legacy 'duration' name for BXKR
        rating: body.rating != null ? Number(body.rating) : null,
        weight_completed_with:
          body.weight_completed_with != null ? Number(body.weight_completed_with) : null,
        sets_completed: body.sets_completed != null ? Number(body.sets_completed) : null,
        notes,

        is_benchmark:
          body.is_benchmark === true ||
          String(body.is_benchmark || "").toLowerCase() === "true" ||
          Object.keys(provided).length > 0,

        benchmark_metrics: Object.keys(provided).length > 0 ? provided : undefined,

        created_at: Timestamp.fromDate(now),
        updated_at: Timestamp.fromDate(now),
      };

      await docRef.set(payload, { merge: true });
      return res.status(201).json({ ok: true, type: "bxkr", id: docId });
    }

    // ---------- No valid mode ----------
    return res.status(400).json({
      error: "Invalid payload: send gym { sets[] } OR benchmark metrics / flags.",
    });
  } catch (err: any) {
    console.error("[completions/create] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to create completion" });
  }
}
