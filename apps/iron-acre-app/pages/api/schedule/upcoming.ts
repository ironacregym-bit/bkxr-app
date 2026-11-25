// pages/api/schedule/upcoming.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

const ACTIVE_BOOKING_STATUSES = new Set([
  "confirmed",
  "pending_payment",
  "pay_on_day",
  "member_free",
  "bank_pending",
]);

function toIsoOrNull(value: any): string | null {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : null;
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function getClassData(classId: string) {
  if (!classId) return null;

  const classesDoc = await firestore.collection("classes").doc(classId).get();
  if (classesDoc.exists) return classesDoc.data() as any;

  const classDoc = await firestore.collection("class").doc(classId).get();
  if (classDoc.exists) return classDoc.data() as any;

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { location, from, to } = req.query;

  if (!location || !from || !to) {
    return res.status(400).json({ error: "Missing location or date range" });
  }

  try {
    const fromDate = new Date(String(from));
    const toDate = new Date(String(to));

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ error: "Invalid from/to dates" });
    }

    const sessionsSnap = await firestore
      .collection("session")
      .where("start_time", ">=", fromDate)
      .where("start_time", "<=", toDate)
      .orderBy("start_time", "asc")
      .get();

    const sessions = await Promise.all(
      sessionsSnap.docs.map(async (doc) => {
        const data = doc.data() as any;

        const gymId = String(data?.gym_id || "").trim();
        const gymDoc = gymId ? await firestore.collection("gyms").doc(gymId).get() : null;
        const gymData = gymDoc?.exists ? (gymDoc.data() as any) : null;

        if (!gymData || String(gymData.location || "") !== String(location)) {
          return null;
        }

        const classId = String(data?.class_id || "").trim();
        const classData =
          String(data?.class_name || "").trim()
            ? null
            : await getClassData(classId);

        const bookingsSnap = await firestore
          .collection("bookings")
          .where("session_id", "==", doc.id)
          .get();

        const activeBookingCount = bookingsSnap.docs.filter((bookingDoc) => {
          const booking = bookingDoc.data() as any;
          const status = String(booking?.status || "").trim().toLowerCase();
          return ACTIVE_BOOKING_STATUSES.has(status);
        }).length;

        return {
          id: doc.id,
          class_id: classId || null,
          class_name:
            String(data?.class_name || "").trim() ||
            String(classData?.name || "").trim() ||
            String(classData?.title || "").trim() ||
            String(classData?.class_name || "").trim() ||
            classId ||
            null,
          coach_name: data?.coach_name || null,
          start_time: toIsoOrNull(data?.start_time),
          end_time: toIsoOrNull(data?.end_time),
          price: Number(data?.price || 9),
          drop_in_price: Number(data?.drop_in_price || 12),
          max_attendance: Number(data?.max_attendance || 0),
          current_attendance: activeBookingCount,
          gym_id: gymId || null,
          gym_name: gymData?.name || null,
          location: gymData?.location || null,
        };
      })
    );

    return res.status(200).json({
      sessions: sessions.filter(Boolean),
    });
  } catch (err: any) {
    console.error("Schedule API error:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch sessions" });
  }
}
