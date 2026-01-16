
// pages/api/completions/freestyle.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type Payload = {
  activity_type?: string;
  duration?: number;                 // ← minutes (NEW canonical)
  calories_burned?: number;
  weight_completed_with?: number | null;
  rpe?: number | null;
  when?: string;                     // ISO
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
    const duration = Number(body.duration || 0); // minutes
    const calories_burned = Number(body.calories_burned || 0);
    const weight_completed_with =
      body.weight_completed_with === null || body.weight_completed_with === undefined
        ? null
        : Number(body.weight_completed_with);
    const rpe = body.rpe != null ? Number(body.rpe) : null;
    const whenIso = body.when ? new Date(body.when) : new Date();
    const notes = typeof body.notes === "string" ? body.notes : null;

    const now = new Date();

    const doc = {
      user_email: session.user.email,

      // Freestyle marker
      is_freestyle: true,

      // Canonical fields you asked for
      activity_type,
      duration: Number.isFinite(duration) ? Math.max(0, duration) : 0, // minutes
      calories_burned: Number.isFinite(calories_burned) ? Math.max(0, calories_burned) : 0,
      weight_completed_with: Number.isFinite(Number(weight_completed_with))
        ? Number(weight_completed_with)
        : null,

      rpe: Number.isFinite(rpe as number) ? (rpe as number) : null,
      notes: notes || null,

      // Timeline
      completed_date: whenIso,
      started_at: whenIso,

      // Housekeeping (match your schema)
      sets_completed: null,
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
