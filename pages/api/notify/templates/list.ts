
// pages/api/notify/templates/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const role = (session?.user as any)?.role || "user";
  if (!session?.user?.email || (role !== "admin" && role !== "gym")) return res.status(401).json({ error: "Unauthorized" });

  try {
    const snap = await firestore.collection("notification_templates").orderBy("key").get().catch(async () => {
      const s = await firestore.collection("notification_templates").get();
      return s;
    });
    const templates = snap.docs.map((d) => ({ key: d.id, ...(d.data() as any) }));
    return res.status(200).json({ templates });
  } catch (e: any) {
    console.error("[templates/list]", e?.message || e);
    return res.status(500).json({ error: "Failed to list templates" });
  }
}
