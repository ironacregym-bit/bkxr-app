
// pages/api/recipes/favourites.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

const isoNow = () => new Date().toISOString();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  const favCol = firestore.collection("users").doc(email).collection("recipe_favourites");

  try {
    if (req.method === "GET") {
      const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 100);
      const snap = await favCol.orderBy("added_at", "desc").limit(limit).get();
      const ids = snap.docs.map((d) => d.id);

      // Join some recipe fields for display
      const recipes: any[] = [];
      if (ids.length) {
        const tasks = ids.slice(0, limit).map((id) => firestore.collection("recipes").doc(id).get());
        const docs = await Promise.all(tasks);
        for (const doc of docs) {
          if (doc.exists) recipes.push({ id: doc.id, ...(doc.data() as any) });
        }
      }
      return res.status(200).json({ favourites: ids, recipes });
    }

    if (req.method === "POST") {
      const { recipe_id } = (req.body || {}) as { recipe_id?: string };
      if (!recipe_id) return res.status(400).json({ error: "recipe_id required" });
      await favCol.doc(recipe_id).set({ added_at: isoNow() }, { merge: true });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const id = String(req.query.id || (req.body as any)?.id || "").trim();
      if (!id) return res.status(400).json({ error: "id required" });
      await favCol.doc(id).delete();
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    console.error("[recipes/favourites]", e?.message || e);
    return res.status(500).json({ error: "Favourites error" });
  }
}
