import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { location, from, to } = req.query;

  if (!location || !from || !to) {
    return res.status(400).json({ error: "Missing location or date range" });
  }

  try {
    const fromDate = new Date(from as string);
    const toDate = new Date(to as string);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ error: "Invalid from/to dates" });
    }

    // Fetch sessions within date range (collection name is "session")
    const sessionsSnap = await firestore
      .collection("session")
      .where("start_time", ">=", fromDate)
      .where("start_time", "<=", toDate)
      .orderBy("start_time", "asc")
      .get();

    const sessions = await Promise.all(
      sessionsSnap.docs.map(async (doc) => {
        const data = doc.data() as any;

        // Lookup gym details
        const gymId = String(data.gym_id || "");
        const gymDoc = gymId ? await firestore.collection("gyms").doc(gymId).get() : null;
        const gymData = gymDoc && gymDoc.exists ? (gymDoc.data() as any) : null;

        // Filter by location (from gyms collection)
        if (!gymData || String(gymData.location || "") !== String(location)) {
          return null;
        }

        // Count bookings for this session (simple count)
        const bookingsSnap = await firestore
          .collection("bookings")
          .where("session_id", "==", doc.id)
          .get();

        return {
          id: doc.id,
          class_id: data.class_id || null,
          coach_name: data.coach_name || null,
          start_time: data.start_time?.toDate?.()?.toISOString?.() || null,
          end_time: data.end_time?.toDate?.()?.toISOString?.() || null,
          price: Number(data.price || 0),
          max_attendance: Number(data.max_attendance || 0),
          current_attendance: bookingsSnap.size,
          gym_name: gymData?.name || null,
          location: gymData?.location || null,
        };
      })
    );

    return res.status(200).json({ sessions: sessions.filter(Boolean) });
  } catch (err: any) {
    console.error("Schedule API error:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch sessions" });
  }
}
