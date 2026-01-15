
// pages/api/exercises/delete.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const session = await getServerSession(req, res, authOptions);
  const role = (session?.user as any)?.role || "user";
  if (!session?.user?.email || (role !== "admin" && role !== "gym")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const id = String(req.query.id || "").trim();
  if (!id) return res.status(400).json({ error: "Missing id" });

  try {
    await firestore.collection("exercises").doc(id).delete();
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[exercises/delete] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to delete exercise" });
  }
}
