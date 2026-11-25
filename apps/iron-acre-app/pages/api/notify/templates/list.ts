
// pages/api/notify/templates/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const role = (session?.user as any)?.role || "user";
  if (!session?.user?.email || (role !== "admin" && role !== "gym")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const snap = await firestore.collection("notification_templates").orderBy("key").get();
    const templates = snap.docs.map((d) => ({ key: d.id, ...(d.data() || {}) }));
    return res.status(200).json({ templates });
  } catch (e: any) {
   
  }
}
