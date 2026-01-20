
// pages/api/recipes/delete.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow","POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const session = await getServerSession(req, res, authOptions);
  const role = (session?.user as any)?.role || "user";
  if (!session?.user?.email || (role !== "admin" && role !== "gym")) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "id required" });
    await firestore.collection("recipes").doc(String(id)).delete();
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[recipes/delete]", e?.message || e);
    return res.status(500).json({ error: "Delete failed" });
  }
}
