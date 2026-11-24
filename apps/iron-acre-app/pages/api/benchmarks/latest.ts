
// pages/api/benchmarks/latest.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type Row = { name: string; value: number | null; unit: string | null; date: string };

function isoFromAny(d: any): string {
  try {
    const dt =
      d?.toDate?.() instanceof Date
        ? d.toDate()
        : d
        ? new Date(d)
        : new Date();
    return isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

const PART_LABEL: Record<string, string> = {
  engine: "Engine",
  power: "Power",
  core: "Core",
  ladder: "Ladder",
  load: "Load",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

    const email = (req.query.email as string) || session.user.email;
    const limit = Math.min(Number(req.query.limit || 10), 25);

    // Latest completions marked as benchmark for this user
    const snap = await firestore
      .collection("workoutCompletions")
      .where("user_email", "==", email)
      .where("is_benchmark", "==", true)
      .orderBy("completed_date", "desc")
      .limit(20) // read a few docs and then slice parts below
      .get();

    const out: Row[] = [];

    for (const doc of snap.docs) {
      const c = doc.data() as any;
      const dateIso = isoFromAny(c.completed_date || c.started_at);

      // Preferred: structured benchmark_metrics per your /benchmarks/log API
      const bm = c.benchmark_metrics as Record<string, any> | undefined;
      if (bm && typeof bm === "object") {
        for (const [key, val] of Object.entries(bm)) {
          if (!val || typeof val !== "object") continue;

          const name = PART_LABEL[key.toLowerCase()] || key;
          const weight = val.weight_kg != null ? Number(val.weight_kg) : null;
          const rounds = val.rounds_completed != null ? Number(val.rounds_completed) : null;

          if (weight != null && Number.isFinite(weight)) {
            out.push({ name, value: weight, unit: "kg", date: dateIso });
          } else if (rounds != null && Number.isFinite(rounds)) {
            out.push({ name, value: rounds, unit: "sets", date: dateIso });
          } else {
            // fallback to completion aggregates if present
            const aggW = c.weight_completed_with != null ? Number(c.weight_completed_with) : null;
            const aggS = c.sets_completed != null ? Number(c.sets_completed) : null;
            if (aggW != null && Number.isFinite(aggW)) out.push({ name, value: aggW, unit: "kg", date: dateIso });
            else if (aggS != null && Number.isFinite(aggS)) out.push({ name, value: aggS, unit: "sets", date: dateIso });
          }
        }
        continue;
      }

      // Older docs fallback
      const name =
        c.focus ??
        c.workout_name ??
        c.title ??
        c.name ??
        "Benchmark";
      const weight = c.weight_completed_with != null ? Number(c.weight_completed_with) : null;
      const sets = c.sets_completed != null ? Number(c.sets_completed) : null;

      if (weight != null && Number.isFinite(weight)) out.push({ name, value: weight, unit: "kg", date: dateIso });
      else if (sets != null && Number.isFinite(sets)) out.push({ name, value: sets, unit: "sets", date: dateIso });
      else out.push({ name, value: null, unit: null, date: dateIso });
    }

    // Limit the number of rows returned to what your UI expects (top 3–5)
    res.status(200).json({ results: out.slice(0, limit) });
  } catch (err: any) {
    console.error("[benchmarks/latest] error:", err?.message || err);
    res.status(500).json({ error: "Failed to load latest benchmarks" });
  }
}
