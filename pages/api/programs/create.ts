import type { NextApiRequest, NextApiResponse } from "next";
import { Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth";
import firestore from "../../../lib/firestoreClient";
import { authOptions } from "../auth/[...nextauth]";

type ProgramCreateBody = {
  name?: string;
  start_date?: string;
  weeks?: number;
  assigned_to?: unknown;
  schedule?: Array<{
    workout_id?: string;
    day_of_week?: string | number;
    order?: number | null;
  }>;
  week_overrides?: Record<
    string,
    {
      weeks?: Record<
        string | number,
        {
          percent_1rm?: number | null;
        }
      >;
    }
  >;
};

function parseDateToTimestamp(s: string): Timestamp | null {
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setHours(12, 0, 0, 0);
  return Timestamp.fromDate(dt);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

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

  const body = (req.body || {}) as ProgramCreateBody;

  const name = body.name;
  const startDateRaw = body.start_date;
  const weeks = body.weeks;
  const assignedTo = body.assigned_to;
  const schedule = Array.isArray(body.schedule) ? body.schedule : [];
  const weekOverrides =
    body.week_overrides && typeof body.week_overrides === "object" ? body.week_overrides : {};

  if (!isNonEmptyString(name) || !isNonEmptyString(startDateRaw) || !isNumber(weeks) || weeks <= 0) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!Array.isArray(assignedTo)) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const tsStartDate = parseDateToTimestamp(startDateRaw);
  if (!tsStartDate) {
    return res.status(400).json({ error: "start_date must be a valid date" });
  }

  try {
    const db = firestore;
    const programRef = db.collection("programs").doc();
    const batch = db.batch();
    const now = Timestamp.now();

    batch.set(programRef, {
      program_id: programRef.id,
      name: name.trim(),
      start_date: tsStartDate,
      weeks,
      assigned_to: assignedTo,
      created_by: session.user.email.toLowerCase(),
      created_at: now,
    });

    for (const s of schedule) {
      const workoutId = s?.workout_id;
      if (!isNonEmptyString(workoutId)) continue;

      const ref = programRef.collection("schedule").doc();
      batch.set(ref, {
        workout_id: workoutId,
        day_of_week: s.day_of_week ?? null,
        order: s.order ?? 0,
      });
    }

    for (const workoutId of Object.keys(weekOverrides || {})) {
      if (!isNonEmptyString(workoutId)) continue;
      const ref = programRef.collection("week_overrides").doc(workoutId);
      batch.set(ref, weekOverrides[workoutId] ?? {});
    }

    await batch.commit();

    return res.status(201).json({
      ok: true,
      program_id: programRef.id,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[programs/create] error:", msg);
    return res.status(500).json({ error: "Failed to create program" });
  }
}
