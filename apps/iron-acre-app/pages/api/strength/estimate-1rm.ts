// FILE: pages/api/strength/estimate-1rm.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

function epley(weight: number, reps: number) {
  return weight * (1 + reps / 30);
}

function roundToInc(x: number, inc: number) {
  if (!inc || inc <= 0) return Math.round(x);
  return Math.round(x / inc) * inc;
}

type SetRow = { exercise_id: string; reps: number; weight: number; set: number };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions).catch(() => null);
  const email = String(session?.user?.email || "").trim().toLowerCase();
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  const days = Number(req.query.days || 180);
  const minReps = Number(req.query.minReps || 1);
  const maxReps = Number(req.query.maxReps || 12);
  const rounding = Number(req.query.rounding || 2.5);

  const exerciseFilter = String(req.query.exercise_id || "").trim();

  const since = new Date();
  since.setDate(since.getDate() - (Number.isFinite(days) ? days : 180));

  try {
    const colNames = ["completions", "workoutCompletions"]; // try both
    let docs: any[] = [];

    for (const cn of colNames) {
      try {
        const snap = await firestore
          .collection(cn)
          .where("user_email", "==", email)
          .where("created_at", ">=", since)
          .get();
        if (!snap.empty) docs = docs.concat(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        // ignore collection mismatch
      }
    }

    // If nothing found via user_email, try fallback field "email"
    if (!docs.length) {
      for (const cn of colNames) {
        try {
          const snap = await firestore
            .collection(cn)
            .where("email", "==", email)
            .where("created_at", ">=", since)
            .get();
          if (!snap.empty) docs = docs.concat(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch {
          // ignore
        }
      }
    }

    const best: Record<
      string,
      {
        e1rm: number;
        rounded: number;
        weight: number;
        reps: number;
        completion_id: string;
        created_at: any;
      }
    > = {};

    for (const c of docs) {
      const sets: any[] = Array.isArray(c.sets) ? c.sets : [];
      for (const s of sets) {
        const ex = String(s.exercise_id || "").trim();
        if (!ex) continue;
        if (exerciseFilter && ex.toLowerCase() !== exerciseFilter.toLowerCase()) continue;

        const reps = Number(s.reps || 0);
        const wt = Number(s.weight || 0);
        if (!Number.isFinite(reps) || !Number.isFinite(wt)) continue;
        if (reps < minReps || reps > maxReps) continue;
        if (wt <= 0) continue;

        const est = epley(wt, reps);
        const r = roundToInc(est, rounding);

        const cur = best[ex];
        if (!cur || est > cur.e1rm) {
          best[ex] = {
            e1rm: est,
            rounded: r,
            weight: wt,
            reps,
            completion_id: String(c.id || ""),
            created_at: c.created_at || c.completed_date || c.date_completed || null,
          };
        }
      }
    }

    return res.status(200).json({ ok: true, email, since, best });
  } catch (e: any) {
    console.error("[strength/estimate-1rm]", e?.message || e);
    return res.status(500).json({ error: e?.message || "Failed to estimate 1RM" });
  }
}
