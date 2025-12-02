
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

    // Fetch sessions within date range
    const sessionsSnap = await firestore
      .collection("session")
      .where("start_time", ">=", fromDate)
      .where("start_time", "<=", toDate)
      .orderBy("start_time", "asc")
      .get();

    const sessions = await Promise.all(
      sessionsSnap.docs.map(async (doc) => {
        const data = doc.data();

        // Lookup gym details
        const gymDoc = await firestore.collection("gyms").doc(data.gym_id).get();
        const gymData = gymDoc.exists ? gymDoc.data() : null;

        // Filter by location (from gyms collection)
        if (!gymData || gymData.location !== location) {
          return null;
        }

        // Count bookings for this session
        const bookingsSnap = await firestore
          .collection("bookings")
          .where("session_id", "==", doc.id)
          .get();

        return {
          id: doc.id,
          ...data,
          start_time: data.start_time?.toDate().toISOString() || null,
          end_time: data.end_time ? data.end_time.toDate().toISOString() : null,
          gym_name: gymData.name,
          location: gymData.location,
          current_attendance: bookingsSnap.size,
          max_attendance: data.max_attendance || 0
        };
      })
    );

    // Remove nulls (sessions not matching location)
    const filteredSessions = sessions.filter((s) => s !== null);

    return res.status(200).json({ sessions: filteredSessions });
  } catch (err: any) {
    console.error("Schedule API error:", err.message);
    return res.status(500).json({ error: "Failed to fetch sessions" });
  }
}
