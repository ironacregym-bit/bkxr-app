// pages/api/programs/create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth/next";
import firestore from "../../../lib/firestoreClient";
import { authOptions } from "../auth/[...nextauth]";

type ProgramCreateBody = {
  name?: unknown;
  start_date?: unknown; // optional now
  assigned_to?: unknown; // accepted but ignored now
  weeks?: unknown;
  schedule?: Array<{
    workout_id?: unknown;
    day_of_week?: string | number | null;
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

function toPositiveNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;

  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return null;
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

  const name = isNonEmptyString(body.name) ? body.name.trim() : "";
  const weeks = toPositiveNumber(body.weeks);
  const startDateRaw = isNonEmptyString(body.start_date) ? body.start_date.trim() : "";
  const schedule = Array.isArray(body.schedule) ? body.schedule : [];
  const weekOverrides =
    body.week_overrides && typeof body.week_overrides === "object" ? body.week_overrides : {};

  if (!name) {
    return res.status(400).json({ error: "Program name is required" });
  }

  if (!weeks) {
    return res.status(400).json({ error: "Weeks must be a number greater than 0" });
  }

  let tsStartDate: Timestamp | null = null;
  if (startDateRaw) {
    tsStartDate = parseDateToTimestamp(startDateRaw);
    if (!tsStartDate) {
      return res.status(400).json({ error: "start_date must be a valid date" });
    }
  }

  try {
    const db = firestore;
    const programRef = db.collection("programs").doc();
    const batch = db.batch();
    const now = Timestamp.now();

    batch.set(programRef, {
      program_id: programRef.id,
      name,
      weeks,
      start_date: tsStartDate || null, // optional template metadata only
      created_by: String(session.user.email || "").trim().toLowerCase(),
      created_at: now,
      updated_at: now,
      // assigned_to intentionally removed from template model
    });

    for (const s of schedule) {
      const workoutId =
        typeof s?.workout_id === "string" ? s.workout_id.trim() : String(s?.workout_id || "").trim();

      if (!workoutId) continue;

      const ref = programRef.collection("schedule").doc();

      batch.set(ref, {
        schedule_id: ref.id,
        workout_id: workoutId,
        day_of_week: s.day_of_week ?? null,
        order: typeof s.order === "number" && Number.isFinite(s.order) ? s.order : 0,
        created_at: now,
      });
    }

    for (const workoutId of Object.keys(weekOverrides || {})) {
      if (!isNonEmptyString(workoutId)) continue;

      const ref = programRef.collection("week_overrides").doc(workoutId);

      batch.set(ref, {
        ...(weekOverrides[workoutId] ?? {}),
        workout_id: workoutId,
        updated_at: now,
      });
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
