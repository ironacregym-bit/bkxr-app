
// pages/api/gyms/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const snap = await firestore.collection("gyms").get();
    const gyms = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        name: data?.name || "Unknown Gym",
        location: data?.location || "Unknown",
      };
    });
    return res.status(200).json({ gyms });
  } catch (err: any) {
    console.error("[gyms/list] error:", err?.message || err);
    return res.status(500).json({ gyms: [] });
  }
}
