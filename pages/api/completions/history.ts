// pages/api/completions/history.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

type CompletionSet = { exercise_id: string; set: number; weight: number | null; reps: number | null };
type BenchmarkPart = { style?: string; rounds_completed?: number | null; weight_kg?: number | null; notes?: string | null };
type BenchmarkMetrics = Partial<Record<"engine" | "power" | "core" | "ladder" | "load", BenchmarkPart>>;

function toJSDate(v: any): Date | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate();
    if (v?.seconds) return new Date(v.seconds * 1000);
    if (typeof v === "string") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}
function numOrNull(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
function difficultyFromRPE(rpe?: number | null) {
  if (rpe == null || isNaN(rpe)) return "—";
  if (rpe <= 4) return "Easy";
  if (rpe <= 7) return "Medium";
  return "Hard";
}
function bestSetByExercise(sets: CompletionSet[] | undefined) {
  const map = new Map<string, CompletionSet>();
  (sets || []).forEach((s) => {
    const w = s.weight ?? 0;
    const r = s.reps ?? 0;
    const prev = map.get(s.exercise_id);
    if (!prev) map.set(s.exercise_id, s);
    else {
      const pw = prev.weight ?? 0;
      const pr = prev.reps ?? 0;
      if (w > pw || (w === pw && r > pr)) map.set(s.exercise_id, s);
    }
  });
  return map;
}
function heaviestOverall(sets: CompletionSet[] | undefined): CompletionSet | null {
  let top: CompletionSet | null = null;
  (sets || []).forEach((s) => {
    if (!top) top = s;
    else {
      const wt = top.weight ?? 0, wr = s.weight ?? 0;
      const rt = top.reps ?? 0, rr = s.reps ?? 0;
      if (wr > wt || (wr === wt && rr > rt)) top = s;
    }
  });
  return top;
}
function totalVolume(sets: CompletionSet[] | undefined) {
  return (sets || []).reduce((acc, s) => acc + (s.weight ?? 0) * (s.reps ?? 0), 0);
}
function summariseBenchmark(metrics?: BenchmarkMetrics | null) {
  let rounds = 0;
  let maxLoad = 0;
  if (metrics && typeof metrics === "object") {
    Object.values(metrics).forEach((p) => {
      if (!p) return;
      if (typeof p.rounds_completed === "number") rounds += Math.max(0, Math.floor(p.rounds_completed));
      if (typeof p.weight_kg === "number") maxLoad = Math.max(maxLoad, p.weight_kg);
    });
  }
  return { rounds_completed: rounds || null, load_kg: maxLoad || null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email, range, limit, workout_id, type } = req.query as {
    email?: string;
    range?: "week" | "month" | "all";
    limit?: string;
    workout_id?: string;
    type?: "gym" | "bxkr" | "all";
  };

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email required" });
  }

  const n = Math.min(Math.max(Number(limit || 5), 1), 50);
  const kind = (type || "all").toLowerCase() as "gym" | "bxkr" | "all";

  try {
    let q: FirebaseFirestore.Query = firestore
      .collection("workoutCompletions")
      .where("user_email", "==", email.toLowerCase());

    if (workout_id && typeof workout_id === "string" && workout_id.trim()) {
      q = q.where("workout_id", "==", workout_id.trim());
    }

    // Prefer completed_date for ordering; Firestore may ask for an index
    const snap = await q.orderBy("completed_date", "desc").limit(200).get();

    const now = new Date();

    // Compute local range start if needed
    let startDate: Date | null = null;
    if (range === "week") {
      const day = now.getDay(); // 0..6
      const diffToMon = (day + 6) % 7;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - diffToMon);
      startDate.setHours(0, 0, 0, 0);
    } else if (range === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    const rows = snap.docs.map((doc) => {
      const d = doc.data() as any;

      const completedAt =
        toJSDate(d.completed_date) ||
        toJSDate(d.date_completed) ||
        toJSDate(d.completed_at) ||
        toJSDate(d.started_at);

      const sets: CompletionSet[] = Array.isArray(d.sets)
        ? d.sets.map((s: any) => ({
            exercise_id: String(s?.exercise_id || ""),
            set: Number(s?.set || 0),
            weight: numOrNull(s?.weight),
            reps: numOrNull(s?.reps),
          }))
        : [];

      const activity = String(d.activity_type || "");
      const isGym = sets.length > 0 || activity.toLowerCase().includes("strength");
      const isBXKR = d.is_benchmark === true || (!isGym && (d.duration != null || d.rating != null));

      const duration_minutes =
        typeof d.duration_minutes === "number"
          ? d.duration_minutes
          : typeof d.duration === "number"
          ? d.duration
          : null;

      const rpe = typeof d.rpe === "number" ? d.rpe : typeof d.rating === "number" ? d.rating : null;
      const difficulty = difficultyFromRPE(rpe);

      // Gym derived
      const topLift = heaviestOverall(sets);
      const vol = totalVolume(sets);

      // BXKR derived
      const bm = (d.benchmark_metrics && typeof d.benchmark_metrics === "object" ? d.benchmark_metrics : null) as BenchmarkMetrics | null;
      const bench = summariseBenchmark(bm);
      const weight_completed_with =
        typeof d.weight_completed_with === "number"
          ? d.weight_completed_with
          : typeof d.weight_completed_with === "string"
          ? Number(d.weight_completed_with) || d.weight_completed_with
          : null;

      return {
        // core
        id: d.id || doc.id,
        workout_id: String(d.workout_id || ""),
        user_email: String(d.user_email || email),
        completed_date: completedAt ? completedAt.toISOString() : null,

        // common summaries (compat + normalised)
        calories_burned: numOrNull(d.calories_burned),
        duration_minutes,
        duration_legacy: typeof d.duration === "number" ? d.duration : null,
        rpe,
        difficulty,
        notes: typeof d.notes === "string" ? d.notes : "",
        focus: d.focus ? String(d.focus) : null,

        // original fields you already returned
        rating: d.rating != null ? Number(d.rating) : null,
        sets_completed: d.sets_completed != null ? Number(d.sets_completed) : null,
        weight_completed_with,

        // classification
        kind: isGym ? "gym" : isBXKR ? "bxkr" : "unknown",

        // type-specific blocks (always present but null if N/A)
        gym: isGym
          ? {
              sets_count: sets.length,
              volume_total: vol, // Σ (kg×reps)
              top_lift: topLift
                ? {
                    exercise_id: topLift.exercise_id,
                    weight: numOrNull(topLift.weight),
                    reps: numOrNull(topLift.reps),
                  }
                : null,
            }
          : null,

        bxkr: isBXKR
          ? {
              rounds_completed: bench.rounds_completed ?? (d.sets_completed != null ? Number(d.sets_completed) : null),
              load_kg: bench.load_kg ?? (typeof weight_completed_with === "number" ? weight_completed_with : null),
              metrics: bm || null,
            }
          : null,
      };
    });

    // Range filter
    const ranged = rows.filter((row) => {
      if (!startDate || !row.completed_date) return true;
      const cd = new Date(row.completed_date);
      return cd >= startDate && cd <= now;
    });

    // Type filter
    const typed =
      kind === "all"
        ? ranged
        : ranged.filter((r) => (kind === "gym" ? r.kind === "gym" : r.kind === "bxkr"));

    // Final limit
    const history = typed.slice(0, n);

    // Cache hints
    res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");

    // Keep your original keys for backward compatibility
    return res.status(200).json({ results: history, history });
  } catch (err: any) {
    console.error("Failed to fetch completion history:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch completion history" });
  }
}
