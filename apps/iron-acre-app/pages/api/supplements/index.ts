import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const snap = await firestore.collection("supplements").get();
      const supplements = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ supplements });
    }

    if (req.method === "POST") {
      const {
        name,
        quantity,
        link,
        brand,
        notes,
        image_url,
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      const ref = await firestore.collection("supplements").add({
        name,
        quantity: quantity ?? null,
        link: link ?? null,
        brand: brand ?? null,
        notes: notes ?? null,
        image_url: image_url ?? null,
        createdAt: new Date(),
      });

      return res.status(201).json({ id: ref.id });
    }

    return res.status(405).end();
  } catch (err: any) {
    console.error("[supplements] error:", err?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
}