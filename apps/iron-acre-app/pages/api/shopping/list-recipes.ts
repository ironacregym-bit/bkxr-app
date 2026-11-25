
// pages/api/shopping/list-recipes.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const listId = String(req.query.list_id || "").trim();
  if (!listId) return res.status(400).json({ error: "list_id required" });

  const coll = firestore.collection("shopping_lists").doc(email).collection("lists").doc(listId).collection("recipes");
  const snap = await coll.orderBy("added_at", "desc").limit(200).get();
  const recipes = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  return res.status(200).json({ recipes });
}
