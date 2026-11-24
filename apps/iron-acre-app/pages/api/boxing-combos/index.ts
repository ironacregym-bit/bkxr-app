// pages/api/boxing-combos/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

function normaliseCombo(d: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>) {
  const id = d.id;
  const x = (d.data() || {}) as any;

  const combo_name = (typeof x.combo_name === "string" && x.combo_name.trim()) || id;
  const category = (typeof x.category === "string" && x.category) || "Basics";
  const difficulty = typeof x.difficulty === "number" ? x.difficulty : null;
  const video_url = typeof x.video_url === "string" ? x.video_url : "";
  const notes = typeof x.notes === "string" ? x.notes : "";
  const actions = Array.isArray(x.actions) ? x.actions : [];

  return { id, combo_name, category, difficulty, video_url, notes, actions };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { q, limit, category, cursor } = req.query as {
      q?: string;
      limit?: string;
      category?: string;
      cursor?: string;
    };

    const n = Math.min(Math.max(Number(limit || 500), 1), 1000);

    let col = firestore.collection("boxing_combos") as FirebaseFirestore.Query;

    if (category && category.trim()) {
      col = col.where("category", "==", category.trim());
    }

    col = col.orderBy("combo_name");

    if (cursor && cursor.trim()) {
      const cursorDoc = await firestore.collection("boxing_combos").doc(cursor.trim()).get();
      if (cursorDoc.exists) col = col.startAfter(cursorDoc);
    }

    col = col.limit(n);

    const snap = await col.get();
    let combos = snap.docs.map(normaliseCombo);

    const qText = q?.toLowerCase().trim();
    if (qText) {
      combos = combos.filter(
        (c) =>
          c.combo_name.toLowerCase().includes(qText) ||
          String(c.category || "").toLowerCase().includes(qText)
      );
    }

    const lastDoc = snap.docs[snap.docs.length - 1];
    const nextCursor = lastDoc ? lastDoc.id : null;

    return res.status(200).json({ combos, nextCursor });
  } catch (err: any) {
    console.error("[boxing-combos/index] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to list boxing combos" });
  }
}
