
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const mealType = String(req.query.meal_type || "").toLowerCase(); // optional
    const q = String(req.query.q || "").trim().toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 100);

    let ref = firestore.collection("recipes") as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
    if (mealType && ["breakfast","lunch","dinner","snack"].includes(mealType)) {
      ref = ref.where("meal_type", "==", mealType);
    }

    // Simple search: fetch a window then filter client-side by title
    const snap = await ref.limit(200).get();
    let items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    if (q) {
      items = items.filter((r) =>
        String(r.title || "").toLowerCase().includes(q) ||
        String(r.meal_type || "").toLowerCase().includes(q)
      );
    }

    items = items.slice(0, limit);
    return res.status(200).json({ recipes: items });
  } catch (e: any) {
    console.error("[recipes/list]", e?.message || e);
    return res.status(500).json({ error: "Failed to list recipes" });
  }
}
