
// pages/api/benchmarks/series.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type Row = {
  part: string;  // "Engine" | "Power" | "Core" | "Ladder" | "Load" | fallback name
  date: string;  // ISO
  weight: number | null;
  sets: number | null;
  workout_id?: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  const email = (req.query.email as string) || session.user.email;
  const limit = Math.min(Number(req.query.limit || 500), 1000);
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  try {
    // Base query: user + date desc
    let q = firestore
      .collection("workoutCompletions")
      .where("user_email", "==", email)
      .orderBy("completed_date", "desc")
      .limit(limit);

    if (from) {
      q = firestore
        .collection("workoutCompletions")
        .where("user_email", "==", email)
        .where("completed_date", ">=", new Date(from))
        .where("completed_date", "<=", to ? new Date(to) : new Date())
        .orderBy("completed_date", "desc")
        .limit(limit);
    }

    const snap = await q.get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    const results: Row[] = [];

    for (const c of docs) {
      const dateIso =
        c.completed_date?.toDate?.() instanceof Date
          ? c.completed_date.toDate().toISOString()
          : c.completed_date
          ? new Date(c.completed_date).toISOString()
          : c.started_at?.toDate?.() instanceof Date
          ? c.started_at.toDate().toISOString()
          : c.started_at
          ? new Date(c.started_at).toISOString()
          : new Date().toISOString();

      const wid = c.workout_id ? String(c.workout_id) : null;

      // Preferred: structured per-part metrics
      const bm = c.benchmark_metrics as any | undefined;
      if (bm && typeof bm === "object") {
        const entries: [string, any][] = Object.entries(bm);
        for (const [key, val] of entries) {
          if (!val || typeof val !== "object") continue;

          // Normalise display name
          let partName = key.toString().trim();
          const map: Record<string, string> = {
            engine: "Engine",
            power: "Power",
            core: "Core",
            ladder: "Ladder",
            load: "Load",
          };
          partName = map[partName.toLowerCase()] || partName;

          const sets =
            val.rounds_completed != null ? Number(val.rounds_completed) :
            c.sets_completed != null ? Number(c.sets_completed) : null;

          const weight =
            val.weight_kg != null ? Number(val.weight_kg) :
            c.weight_completed_with != null ? Number(c.weight_completed_with) : null;

          results.push({
            part: partName,
            date: dateIso,
            weight: Number.isFinite(weight) ? weight : null,
            sets: Number.isFinite(sets) ? sets : null,
            workout_id: wid,
          });
        }
        continue; // We prefer benchmark_metrics when present
      }

      // Fallback: map a single row using generic fields (older docs)
      const isBenchmark =
        c.is_benchmark === true ||
        String(c.is_benchmark || "").toLowerCase() === "true";
      if (isBenchmark) {
        const part =
          c.focus ? String(c.focus) :
          c.workout_name ? String(c.workout_name) :
          "Benchmark";
        results.push({
          part,
          date: dateIso,
          weight: c.weight_completed_with != null ? Number(c.weight_completed_with) : null,
          sets: c.sets_completed != null ? Number(c.sets_completed) : null,
          workout_id: wid,
        });
      }
    }

    return res.status(200).json({ results });
  } catch (err: any) {
    console.error("[benchmarks/series] error:",    console.error("[benchmarks/series] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to build benchmark series" });
  }
}
