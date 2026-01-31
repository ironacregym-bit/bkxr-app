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

// Optional nested input that we will flatten into sets[]
type IncomingExercise = {
  exercise_id: string;
  sets: Array<{ set: number; weight?: number | null; reps?: number | null }>;
};

// ---------- Helpers ----------
function toNumberOrNull(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function mapDifficultyToRPE(v: any): number | null {
  if (!v) return null;
  const s = String(v).toLowerCase();
  if (s === "easy") return 4;
  if (s === "medium") return 6;
  if (s === "hard") return 8;
  const n = Number(v);
  return Number.isFinite(n) ? n : null; // allow direct numeric rpe too
}

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

    // Manual overrides (summary)
    const calories_burned = toNumberOrNull(body.calories_burned);
    // prefer duration_minutes; allow duration as a fallback
    const duration_minutes =
      body.duration_minutes != null
        ? toNumberOrNull(body.duration_minutes)
        : body.duration != null
        ? toNumberOrNull(body.duration)
        : null;

    const activity_type =
      typeof body.activity_type === "string" && body.activity_type.trim() !== ""
        ? body.activity_type.trim()
        : "Strength training";

    // Accept rpe directly OR infer from difficulty string
    const rpe =
      body.rpe != null && Number.isFinite(Number(body.rpe))
        ? Number(body.rpe)
        : mapDifficultyToRPE(body.difficulty);

    const notes = typeof body.notes === "string" ? body.notes : null;

    // Normalise weight_completed_with (string or number accepted)
    let weight_completed_with: number | string | null = null;
    if (body.weight_completed_with != null) {
      const asNum = Number(body.weight_completed_with);
      weight_completed_with = Number.isFinite(asNum) ? asNum : String(body.weight_completed_with);
    }

    const now = new Date();
    const completedDateTS =
      body.completed_at != null
        ? Timestamp.fromDate(new Date(body.completed_at))
        : Timestamp.fromDate(now);

    // Derive gym mode inputs
    const incomingSets: any[] = Array.isArray(body.sets) ? body.sets : [];
    const incomingExercises: IncomingExercise[] = Array.isArray(body.exercises)
      ? body.exercises
      : [];

    // If client sends nested 'exercises', flatten to sets[]
    const flattenedFromExercises: GymCompletionSet[] = [];
    for (const ex of incomingExercises) {
      const exId = String(ex?.exercise_id || "").trim();
      if (!exId || !Array.isArray(ex?.sets)) continue;
      for (const s of ex.sets) {
        const setNo = Number(s?.set || 0);
        if (!Number.isFinite(setNo) || setNo <= 0) continue;
        flattenedFromExercises.push({
          exercise_id: exId,
          set: setNo,
          weight: toNumberOrNull(s?.weight),
          reps: toNumberOrNull(s?.reps),
        });
      }
    }

    // Build unified sets[] (nested first, then explicit 'sets')
    const gymSets: GymCompletionSet[] = [
      ...flattenedFromExercises,
      ...incomingSets
        .map((s: any): GymCompletionSet => ({
          exercise_id: String(s?.exercise_id || "").trim(),
          set: Number(s?.set || 0),
          weight: toNumberOrNull(s?.weight),
          reps: toNumberOrNull(s?.reps),
        }))
        .filter((s: GymCompletionSet) => s.exercise_id && s.set > 0),
    ];

    // Determine mode
    const isGym = gymSets.length > 0;
    const isBenchmarkLike =
      body.engine || body.power || body.core || body.ladder || body.load || body.is_benchmark;

    // New doc (keep history; do not overwrite)
    const docRef = firestore.collection("workoutCompletions").doc();
    const docId = docRef.id;

    // ---------- GYM COMPLETION ----------
    if (isGym || (!isBenchmarkLike && (calories_burned != null || duration_minutes != null || rpe != null || notes || weight_completed_with != null))) {
      // Gym payload: record sets[] if present, and summary overrides when provided.
      const payload: Record<string, any> = {
        id: docId,
        workout_id,
        user_email,
        completed_date: completedDateTS,
        date_completed: completedDateTS, // legacy field

        activity_type,
        created_at: Timestamp.fromDate(now),
        updated_at: Timestamp.fromDate(now),
      };

      if (gymSets.length > 0) payload.sets = gymSets;
      if (calories_burned != null) payload.calories_burned = calories_burned;
      if (duration_minutes != null) payload.duration_minutes = duration_minutes;
      if (rpe != null) payload.rpe = rpe;
      if (notes) payload.notes = notes;
      if (weight_completed_with != null) payload.weight_completed_with = weight_completed_with;

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
            ? (styleStr.toUpperCase() as Style)
            : (styleStr as Style);

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
        duration: duration_minutes ?? null, // legacy 'duration' name for BXKR
        rating: body.rating != null ? Number(body.rating) : null,
        weight_completed_with: weight_completed_with ?? null,
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
      error:
        "Invalid payload: send (a) gym { sets[] } or nested { exercises[] }, or (b) benchmark metrics/flags, or (c) gym summary fields (calories/duration/rpe/notes).",
    });
  } catch (err: any) {
    console.error("[completions/create] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to create completion" });
  }
}
