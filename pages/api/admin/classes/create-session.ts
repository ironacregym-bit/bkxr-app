// pages/api/admin/classes/create-session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

type Body = {
  class_id?: string;
  gym_id?: string;
  date?: string;
  start_time_hhmm?: string;
  end_time_hhmm?: string;
  coach_name?: string;
  price?: number;
  max_attendance?: number;
  notify_members?: boolean;
};

function parseDateTime(dateYMD: string, hhmm: string) {
  const [year, month, day] = dateYMD.split("-").map((x) => Number(x));
  const [hours, minutes] = hhmm.split(":").map((x) => Number(x));

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return null;
  }

  const value = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return isNaN(value.getTime()) ? null : value;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const role = (session?.user as any)?.role || "user";

    if (!session?.user?.email || (role !== "admin" && role !== "gym")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = (req.body || {}) as Body;

    const classId = String(body.class_id || "").trim();
    const gymId = String(body.gym_id || "").trim();
    const date = String(body.date || "").trim();
    const startHHMM = String(body.start_time_hhmm || "").trim();
    const endHHMM = String(body.end_time_hhmm || "").trim();
    const coachName = String(body.coach_name || "").trim();
    const price = Number(body.price || 0);
    const maxAttendance = Number(body.max_attendance || 0);
    const notifyMembers = Boolean(body.notify_members);

    if (!classId) return res.status(400).json({ error: "Class is required" });
    if (!gymId) return res.status(400).json({ error: "Gym is required" });
    if (!date) return res.status(400).json({ error: "Date is required" });
    if (!startHHMM) return res.status(400).json({ error: "Start time is required" });
    if (!endHHMM) return res.status(400).json({ error: "End time is required" });

    const startDate = parseDateTime(date, startHHMM);
    const endDate = parseDateTime(date, endHHMM);

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Invalid date/time supplied" });
    }

    if (endDate <= startDate) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: "Price must be 0 or greater" });
    }

    if (!Number.isFinite(maxAttendance) || maxAttendance < 1) {
      return res.status(400).json({ error: "Max attendance must be at least 1" });
    }

    const [gymDoc, classDoc] = await Promise.all([
      firestore.collection("gyms").doc(gymId).get(),
      firestore.collection("gymClasses").doc(classId).get(),
    ]);

    if (!gymDoc.exists) {
      return res.status(400).json({ error: "Selected gym does not exist" });
    }

    if (!classDoc.exists) {
      return res.status(400).json({ error: "Selected class does not exist" });
    }

    const now = Timestamp.now();
    const ref = firestore.collection("session").doc();

    await ref.set({
      id: ref.id,
      class_id: classId,
      gym_id: gymId,
      start_time: Timestamp.fromDate(startDate),
      end_time: Timestamp.fromDate(endDate),
      coach_name: coachName || null,
      price,
      max_attendance: Math.floor(maxAttendance),
      current_attendance: 0,
      notify_members: notifyMembers,
      created_at: now,
      updated_at: now,
      created_by: String(session.user.email || "").toLowerCase(),
    });

    return res.status(200).json({
      ok: true,
      sessionId: ref.id,
    });
  } catch (err: any) {
    console.error("[admin/classes/create-session]", err?.message || err);
    return res.status(500).json({ error: "Failed to create session" });
  }
}
