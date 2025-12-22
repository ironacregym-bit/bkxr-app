
// pages/api/completions/create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

type Style = "AMRAP" | "EMOM" | "LADDER" | string;

type PartMetrics = {
  style?: Style;
  rounds_completed?: number | null;
  weight_kg?: number | null;
  notes?: string | null;
};

type PartName = "engine" | "power" | "core" | "ladder" | "load";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      workout_id,
      user_email,

      // Optional fields your client may send
      calories_burned,
      duration,
      rating,
      sets_completed,
      weight_completed_with,
      notes,

      // Optional time inputs (for back-compat); if absent, we use "now"
      completed_at, // ISO string or undefined
      started_at,   // ISO string or undefined (stored only if provided)

      // Benchmark additions (either per-part keys or a combined object)
      is_benchmark,
      engine,
      power,
      core,
      ladder,
      load,
      benchmark_metrics,
    } = req.body || {};

    if (!workout_id || !user_email) {
      return res.status(400).json({ error: "workout_id and user_email are required" });
    }

    const now = new Date();
    const completedDateTS = completed_at
      ? Timestamp.fromDate(new Date(completed_at))
      : Timestamp.fromDate(now);

    // Deterministic doc id for idempotency and for your /api/completions checks
    const docId = `${String(user_email)}_${String(workout_id)}`;
    const docRef = firestore.collection("workoutCompletions").doc(docId);
    const snap = await docRef.get();

    // ---- Build benchmark metrics safely -------------------------------------
    const parts: PartName[] = ["engine", "power", "core", "ladder", "load"];
    const provided: Record<PartName, PartMetrics> = {} as any;
    let anyBenchmarkProvided = false;

    // Helper to normalise a single part metrics object
    const normalisePart = (v: any): PartMetrics | undefined => {
      if (!v || typeof v !== "object") return undefined;

      const styleStr = typeof v.style === "string" ? v.style.trim() : undefined;
      const style: Style | undefined =
        styleStr && ["AMRAP", "EMOM", "LADDER"].includes(styleStr.toUpperCase())
          ? styleStr.toUpperCase()
          : styleStr; // allow custom strings, but normalise common values

      const rounds =
        v.rounds_completed != null && Number.isFinite(Number(v.rounds_completed))
          ? Math.max(0, Math.floor(Number(v.round          ? Math.max(0, Math.floor(Number(v.rounds_completed)))
          : undefined;

      const weight =
        v.weight_kg != null && Number.isFinite(Number(v.weight_kg))
          ? Number(v.weight_kg)
          : v.weight_kg === null
          ? null
          : undefined;

      const note = typeof v.notes === "string" ? v.notes : undefined;

      const hasContent = style != null || rounds != null || weight != null || note != null;
      return hasContent
        ? { style, rounds_completed: rounds, weight_kg: weight, notes: note }
        : undefined;
    };

    // Accept either top-level part keys or combined benchmark_metrics object
    const sourceMetrics: Record<string, any> = {
      ...(benchmark_metrics && typeof benchmark_metrics === "object" ? benchmark_metrics : {}),
      ...(engine ? { engine } : {}),
      ...(power ? { power } : {}),
      ...(core ? { core } : {}),
      ...(ladder ? { ladder } : {}),
      ...(load ? { load } : {}),
    };

    for (const p of parts) {
      const norm = normalisePart(sourceMetrics[p]);
      if (norm) {
        provided[p] = norm;
        anyBenchmarkProvided = true;
      }
    }

    // Aggregates from provided parts
    const totalRounds = parts.reduce((sum, p) => {
      const rc = provided[p]?.rounds_completed;
      return sum + (rc != null ? rc : 0);
    }, 0);

    const maxWeight = parts.reduce((max, p) => {
      const w = provided[p]?.weight_kg;
      return w != null ? Math.max(max, w) : max;
    }, 0);

    // Final flags
    const finalIsBenchmark =
      is_benchmark === true ||
      String(is_benchmark || "").toLowerCase() === "true" ||
      anyBenchmarkProvided;

    // ---- Build payload -------------------------------------------------------
    const payload: any = {
      id: docId,                                  // ✅ matches your collection
      workout_id: String(workout_id),
      user_email: String(user_email),
      completed_date: completedDateTS,            // ✅ key your history/orderBy relies on

      calories_burned: Number(calories_burned ?? 0),
      duration: Number(duration ?? 0),
      rating: rating != null ? Number(rating) : null,

      // If client sent sets_completed, keep it; otherwise use aggregate if any parts provided
      sets_completed:
        sets_completed != null
          ? Number(sets_completed)
          : anyBenchmarkProvided
          ? Number(totalRounds)
          : Number(0),

      // If client sent weight, keep it; otherwise use aggregate max across parts
      weight_completed_with:
        weight_completed_with != null
          ? Number(weight_completed_with)
          : anyBenchmarkProvided && maxWeight > 0
          ? Number(maxWeight)
          : Number(0),

      notes: typeof notes === "string" ? notes : "",

      updated_at: Timestamp.fromDate(now),        // optional audit field
    };

    if (finalIsBenchmark) payload.is_benchmark = true;
    if (anyBenchmarkProvided) payload.benchmark_metrics = provided;

    // Optional fields: keep only if provided
    if (started_at) payload.started_at = Timestamp.fromDate(new Date(started_at));

    // Create vs update
    if (!snap.exists) {
      payload.created_at = Timestamp.fromDate(now);
    }

    // ---- Persist -------------------------------------------------------------
    await docRef.set(payload, { merge: true });

    const saved = (await docRef.get()).data() || null;
    return res.status(200).json({ ok: true, entry: saved });
  } catch (err: any) {
    console.error("Failed to create completion:", err?.message || err);
    return res.status(500).json({ error: "Failed to create completion" });
  }
}
