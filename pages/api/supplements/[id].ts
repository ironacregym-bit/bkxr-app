import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };

  try {
    const ref = firestore.collection("supplements").doc(id);

    if (req.method === "PUT") {
      await ref.update({
        ...req.body,
        updatedAt: new Date(),
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      await ref.delete();
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  } catch (err: any) {
    console.error("[supplements/[id]] error:", err?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
}