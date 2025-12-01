
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

    const snap = await firestore
      .collection("bookings")
      .where("location", "==", location)
      .where("start_time", ">=", fromDate)
      .where("start_time", "<=", toDate)
      .orderBy("start_time", "asc")
      .get();

    const sessions = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        start_time: data.start_time?.toDate().toISOString() || null,
        end_time: data.end_time ? data.end_time.toDate().toISOString() : null
      };
    });

    return res.status(200).json({ sessions });
  } catch (err: any) {
    console.error("Schedule API error:", err.message);
    return res.status(500).json({ error: "Failed to fetch sessions" });
  }
}
