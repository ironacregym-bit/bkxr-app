
// pages/api/recipes/get.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }
    const id = String(req.query.id || "").trim();
    if (!id) return res.status(400).json({ error: "id required" });
    const doc = await firestore.collection("recipes").doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: "Not found" });
    return res.status(200).json({ id: doc.id, ...(doc.data() as any) });
  } catch (e: any) {
    console.error("[recipes/get]", e?.message || e);
    return res.status(500).json({ error: "Failed to get recipe" });
  }
}
