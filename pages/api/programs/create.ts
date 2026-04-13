import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions).catch(() => null);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const role = (session.user as any)?.role;
  if (!["admin", "gym"].includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const {
    name,
    start_date,
    weeks,
    assigned_to,
    schedule = [],
    week_overrides = {},
  } = req.body || {};

  if (!name || !start_date || !weeks || !Array.isArray(assigned_to)) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const db = firestore;
    const programRef = db.collection("programs").doc();
    const batch = db.batch();
    const now = Timestamp.now();

    batch.set(programRef, {
      program_id: programRef.id,
      name,
      start_date: Timestamp.fromDate(new Date(start_date)),
      weeks,
      assigned_to,
      created_by: session.user.email.toLowerCase(),
      created_at: now,
    });

    // schedule
    for (const s of schedule) {
      if (!s.workout_id) continue;
      const ref = programRef.collection("schedule").doc();
      batch.set(ref, {
        workout_id: s.workout_id,
        day_of_week: s.day_of_week,
        order: s.order ?? 0,
      });
    }

    // week overrides
    for (const workoutId of Object.keys(week_overrides)) {
      const ref = programRef.collection("week_overrides").doc(workoutId);
      batch.set(ref, week_overrides[workoutId]);
    }

    await batch.commit();

    return res.status(201).json({
      ok: true,
      program_id: programRef.id,
    });
  } catch (e: any) {
    console.error("[programs/create] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to create program" });
  }
}
