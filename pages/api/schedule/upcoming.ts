// pages/api/schedule/upcoming.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

const ACTIVE_BOOKING_STATUSES = new Set([
  "confirmed",
  "pending_payment",
  "pay_on_day",
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
        const classDoc = classId ? await firestore.collection("classes").doc(classId).get() : null;
        const classData = classDoc?.exists ? (classDoc.data() as any) : null;

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
            String(classData?.name || "").trim() ||
            String(classData?.title || "").trim() ||
            classId ||
            null,
          coach_name: data?.coach_name || null,
          start_time: toIsoOrNull(data?.start_time),
          end_time: toIsoOrNull(data?.end_time),
          price: Number(data?.price || 0),
          max_attendance: Number(data?.max_attendance || 0),
          current_attendance: activeBookingCount,
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
