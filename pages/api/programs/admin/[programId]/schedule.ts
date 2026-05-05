// File: pages/api/programs/admin/[programId]/schedule.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import firestore from "../../../../../lib/firestoreClient";
import { authOptions } from "../../../auth/[...nextauth]";

type ScheduleRow = {
  schedule_id: string;
  workout_id: string;
  day_of_week: string | number | null;
  order: number;
};

type ScheduleGetResponse = {
  ok: true;
  program_id: string;
  schedule: ScheduleRow[];
};

type SchedulePostBody = {
  workout_id?: string;
  day_of_week?: string | number | null;
  order?: number | null;
  schedule_id?: string;
};

type SchedulePostResponse = {
  ok: true;
  program_id: string;
  schedule_id: string;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function toIntOrDefault(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions).catch(() => null);
  const role = (session?.user as any)?.role;

  if (!session || !["admin", "gym"].includes(role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const programIdRaw = req.query.programId;
  const programId = typeof programIdRaw === "string" ? programIdRaw.trim() : "";

  if (!isNonEmptyString(programId)) {
    return res.status(400).json({ error: "Missing programId" });
  }

  if (req.method === "GET") {
    try {
      const snap = await firestore.collection("programs").doc(programId).collection("schedule").get();

      const schedule: ScheduleRow[] = snap.docs
        .map((d) => {
          const workout_id = String(d.get("workout_id") || "");
          const day_of_week = (d.get("day_of_week") ?? null) as string | number | null;
          const order = toIntOrDefault(d.get("order"), 0);

          return {
            schedule_id: d.id,
            workout_id,
            day_of_week,
            order,
          };
        })
        .filter((r) => isNonEmptyString(r.workout_id))
        .sort((a, b) => {
          const aDay = typeof a.day_of_week === "number" ? a.day_of_week : 99;
          const bDay = typeof b.day_of_week === "number" ? b.day_of_week : 99;
          if (aDay !== bDay) return aDay - bDay;
          return a.order - b.order;
        });

      const payload: ScheduleGetResponse = { ok: true, program_id: programId, schedule };
      return res.status(200).json(payload);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[programs/admin/[programId]/schedule GET] error:", msg);
      return res.status(500).json({ error: "Failed to load program schedule" });
    }
  }

  if (req.method === "POST") {
    const body = (req.body || {}) as SchedulePostBody;

    if (!isNonEmptyString(body.workout_id)) {
      return res.status(400).json({ error: "workout_id is required" });
    }

    const day_of_week = body.day_of_week ?? null;
    const order = toIntOrDefault(body.order, 0);
    const scheduleId = isNonEmptyString(body.schedule_id) ? body.schedule_id.trim() : "";

    try {
      const programRef = firestore.collection("programs").doc(programId);
      const scheduleRef = scheduleId ? programRef.collection("schedule").doc(scheduleId) : programRef.collection("schedule").doc();

      await scheduleRef.set(
        {
          workout_id: body.workout_id.trim(),
          day_of_week,
          order,
        },
        { merge: true }
      );

      const payload: SchedulePostResponse = { ok: true, program_id: programId, schedule_id: scheduleRef.id };
      return res.status(200).json(payload);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[programs/admin/[programId]/schedule POST] error:", msg);
      return res.status(500).json({ error: "Failed to update program schedule" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
