// pages/api/admin/sessions/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { Timestamp } from "@google-cloud/firestore";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

type SessionDetailResponse = {
  id: string;
  class_id: string | null;
  class_name: string;
  gym_id: string | null;
  gym_name: string;
  coach_name?: string | null;
  start_time: string | null;
  end_time: string | null;
  price: number;
  drop_in_price: number;
  max_attendance: number;
  current_attendance: number;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  notify_members?: boolean;
  cancelled?: boolean;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
};

const ACTIVE_BOOKING_STATUSES = new Set([
  "confirmed",
  "pending_payment",
  "pay_on_day",
  "member_free",
  "bank_pending",
]);

function toIso(value: any): string | null {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : null;
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function asDate(value: any): Date | null {
  if (!value) return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function combineDateAndTime(dateStr: string, hhmm: string): Date | null {
  const date = String(dateStr || "").trim();
  const time = String(hhmm || "").trim();

  if (!date || !time) return null;

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }

  const d = new Date(year, month - 1, day, hour, minute, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

async function resolveClassData(classId: string | null, sessionData?: any) {
  const inlineName = String(sessionData?.class_name || "").trim();
  if (!classId) {
    return {
      classId: null,
      className: inlineName || "Class",
    };
  }

  if (inlineName) {
    return {
      classId,
      className: inlineName,
    };
  }

  const classesDoc = await firestore.collection("classes").doc(classId).get();
  if (classesDoc.exists) {
    const d = classesDoc.data() as any;
    return {
      classId,
      className: String(d?.name || d?.title || d?.class_name || classId),
    };
  }

  const legacyDoc = await firestore.collection("gymClasses").doc(classId).get();
  if (legacyDoc.exists) {
    const d = legacyDoc.data() as any;
    return {
      classId,
      className: String(d?.name || d?.title || d?.class_name || classId),
    };
  }

  return {
    classId,
    className: classId,
  };
}

async function resolveGymData(gymId: string | null) {
  if (!gymId) {
    return {
      gymId: null,
      gymName: "Gym",
    };
  }

  const gymDoc = await firestore.collection("gyms").doc(gymId).get();
  if (!gymDoc.exists) {
    return {
      gymId,
      gymName: gymId,
    };
  }

  const d = gymDoc.data() as any;
  return {
    gymId,
    gymName: String(d?.name || gymId),
  };
}

async function getActiveAttendance(sessionId: string, fallback = 0) {
  const bookingsSnap = await firestore
    .collection("bookings")
    .where("session_id", "==", sessionId)
    .get();

  const count = bookingsSnap.docs.filter((doc) => {
    const booking = doc.data() as any;
    const status = String(booking?.status || "").trim().toLowerCase();
    return ACTIVE_BOOKING_STATUSES.has(status);
  }).length;

  return Number.isFinite(count) ? count : fallback;
}

async function buildResponse(id: string, data: any): Promise<SessionDetailResponse> {
  const classId = String(data?.class_id || "").trim() || null;
  const gymId = String(data?.gym_id || "").trim() || null;

  const [{ className }, { gymName }, currentAttendance] = await Promise.all([
    resolveClassData(classId, data),
    resolveGymData(gymId),
    getActiveAttendance(id, Number(data?.current_attendance || 0)),
  ]);

  return {
    id,
    class_id: classId,
    class_name: className,
    gym_id: gymId,
    gym_name: gymName,
    coach_name: data?.coach_name ? String(data.coach_name) : null,
    start_time: toIso(data?.start_time),
    end_time: toIso(data?.end_time),
    price: Number(data?.price || 9),
    drop_in_price: Number(data?.drop_in_price || 12),
    max_attendance: Number(data?.max_attendance || 0),
    current_attendance: currentAttendance,
    created_at: toIso(data?.created_at),
    updated_at: toIso(data?.updated_at),
    created_by: data?.created_by ? String(data.created_by) : null,
    notify_members: Boolean(data?.notify_members),
    cancelled: Boolean(data?.cancelled),
    cancelled_at: toIso(data?.cancelled_at),
    cancelled_by: data?.cancelled_by ? String(data.cancelled_by) : null,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SessionDetailResponse | { ok: true } | { error: string }>
) {
  const authSession = await getServerSession(req, res, authOptions);
  const role = (authSession?.user as any)?.role || "user";
  const actorEmail = String(authSession?.user?.email || "").trim().toLowerCase();

  if (!actorEmail || (role !== "admin" && role !== "gym")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = String(req.query.id || "").trim();

  if (!id) {
    return res.status(400).json({ error: "Missing id" });
  }

  const docRef = firestore.collection("session").doc(id);

  try {
    if (req.method === "GET") {
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Session not found" });
      }

      const data = doc.data() as any;
      const response = await buildResponse(doc.id, data);
      return res.status(200).json(response);
    }

    if (req.method === "PATCH") {
      const {
        class_id,
        gym_id,
        date,
        start_time_hhmm,
        end_time_hhmm,
        coach_name,
        price,
        drop_in_price,
        max_attendance,
        notify_members,
      } = (req.body || {}) as {
        class_id?: string;
        gym_id?: string;
        date?: string;
        start_time_hhmm?: string;
        end_time_hhmm?: string;
        coach_name?: string;
        price?: number;
        drop_in_price?: number;
        max_attendance?: number;
        notify_members?: boolean;
      };

      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Session not found" });
      }

      const current = doc.data() as any;
      const currentAttendance = await getActiveAttendance(id, Number(current?.current_attendance || 0));

      const nextClassId = String(class_id || "").trim() || null;
      const nextGymId = String(gym_id || "").trim() || null;

      if (!nextClassId) {
        return res.status(400).json({ error: "class_id is required" });
      }

      if (!nextGymId) {
        return res.status(400).json({ error: "gym_id is required" });
      }

      const startDate = combineDateAndTime(String(date || ""), String(start_time_hhmm || ""));
      const endDate = combineDateAndTime(String(date || ""), String(end_time_hhmm || ""));

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Valid date, start time and end time are required" });
      }

      if (endDate.getTime() <= startDate.getTime()) {
        return res.status(400).json({ error: "End time must be after start time" });
      }

      const nextMaxAttendance = Number(max_attendance || 0);
      if (!Number.isFinite(nextMaxAttendance) || nextMaxAttendance < Math.max(1, currentAttendance)) {
        return res.status(400).json({
          error: `max_attendance must be at least ${Math.max(1, currentAttendance)}`,
        });
      }

      const nextPrice = Number(price || 0);
      const nextDropInPrice = Number(drop_in_price || 0);

      if (!Number.isFinite(nextPrice) || nextPrice < 0) {
        return res.status(400).json({ error: "price must be a valid number" });
      }

      if (!Number.isFinite(nextDropInPrice) || nextDropInPrice < 0) {
        return res.status(400).json({ error: "drop_in_price must be a valid number" });
      }

      const { className } = await resolveClassData(nextClassId);
      const { gymName } = await resolveGymData(nextGymId);

      await docRef.set(
        {
          class_id: nextClassId,
          class_name: className,
          gym_id: nextGymId,
          gym_name: gymName,
          coach_name: String(coach_name || "").trim() || null,
          start_time: Timestamp.fromDate(startDate),
          end_time: Timestamp.fromDate(endDate),
          price: nextPrice,
          drop_in_price: nextDropInPrice,
          max_attendance: nextMaxAttendance,
          notify_members: Boolean(notify_members),
          updated_at: Timestamp.now(),
          updated_by: actorEmail,
        },
        { merge: true }
      );

      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const doc = await docRef.get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Session not found" });
      }

      const current = doc.data() as any;
      const currentAttendance = await getActiveAttendance(id, Number(current?.current_attendance || 0));

      if (currentAttendance > 0) {
        await docRef.set(
          {
            cancelled: true,
            cancelled_at: Timestamp.now(),
            cancelled_by: actorEmail,
            updated_at: Timestamp.now(),
            updated_by: actorEmail,
          },
          { merge: true }
        );
      } else {
        await docRef.delete();
      }

      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("[admin/sessions/[id]]", err?.message || err);
    return res.status(500).json({ error: "Failed to process session" });
  }
}
