import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../lib/firestoreClient"; // Using Google Cloud Firestore client

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Fetch the single settings document (e.g., ID = "appConfig")
    const docRef = firestore.collection("settings").doc("appConfig");
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "Settings not found" });
    }

    const data = docSnap.data() || {};

    // Return settings with defaults if missing
    res.json({
      rounds: Number(data.rounds ?? 10),
      boxing_rounds: Number(data.boxing_rounds ?? 5),
      bell_rounds: Number(data.bell_rounds ?? 5),
      work_sec: Number(data.work_sec ?? 180),
      rest_sec: Number(data.rest_sec ?? 60),
      default_MET_boxing: Number(data.default_MET_boxing ?? 7.8),
      default_MET_kb: Number(data.default_MET_kb ?? 9.8),
      trainer_phone: data.trainer_phone ?? "",
      trainer_email: data.trainer_email ?? ""
    });
  } catch (err: any) {
    console.error("Firestore read failed:", err.message);
    return res.status(500).json({ error: "Failed to load settings" });
  }
}
