
// pages/api/completions/freestyle.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type Payload = {
  activity_type?: string;
  duration_minutes?: number;
  calories_burned?: number;
  rpe?: number | null;
  when?: string; // ISO
  notes?: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const body = (req.body || {}) as Payload;

    const activity_type = (body.activity_type || "Freestyle").toString();
    const duration_minutes = Number(body.duration_minutes || 0);
    const calories_burned = Number(body.calories_burned || 0);
    const rpe = body.rpe != null ? Number(body.rpe) : null;
    const whenIso = body.when ? new Date(body.when) : new Date();
    const notes = typeof body.notes === "string" ? body.notes : null;

    const now = new Date();

    const doc = {
      user_email: session.user.email,
      is_freestyle: true,
      activity_type,
      duration_minutes: Number.isFinite(duration_minutes) ? duration_minutes : 0,
      calories_burned: Number.isFinite(calories_burned) ? calories_burned : 0,
      rpe: Number.isFinite(rpe as number) ? (rpe as number) : null,
      notes: notes || null,

      // Align with your existing fields:
      completed_date: whenIso, // used by history/graphs
      started_at: whenIso,     // optional but helpful
      sets_completed: null,
      weight_completed_with: null,
      workout_id: null,

      created_at: now,
      updated_at: now,
    };

    const ref = firestore.collection("workoutCompletions").doc();
    await ref.set(doc);
    const snap = await ref.get();

    return res.status(201).json({ ok: true, id: ref.id, data: snap.data() });
  } catch (err: any) {
    console.error("[completions/freestyle] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to log freestyle session" });
  }
}
