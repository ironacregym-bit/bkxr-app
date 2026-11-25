
// pages/api/supplements/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const snap = await firestore.collection("supplements").get();
    const supplements = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        name: data?.name || "Unnamed",
        quantity: data?.quantity ?? null,
        link: data?.link ?? null,
        brand: data?.brand ?? null,
        notes: data?.notes ?? null,
        image_url: data?.image_url ?? null,
      };
    });

    return res.status(200).json({ supplements });
  } catch (err: any) {
    console.error("[supplements/list] error:", err?.message || err);
    return res.status(500).json({ supplements: [] });
  }
}
