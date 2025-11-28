
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { location, from, to } = req.query;
  if (!location || !from || !to) {
    return res.status(400).json({ error: "Missing location or date range" });
  }

  try {
    const snap = await firestore
      .collection("bookings")
      .where("location", "==", location)
      .where("start_time", ">=", new Date(from as string))
      .where("start_time", "<=", new Date(to as string))
      .orderBy("start_time", "asc")
      .get();

    const sessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.status(200).json({ sessions });
  } catch (err: any) {
    console.error("Schedule API error:", err.message);
    return res.status(500).json({ error: "Failed to fetch sessions" });
  }
}
