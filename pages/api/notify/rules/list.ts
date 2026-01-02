
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const role = (session?.user as any)?.role || "user";
  if (!session?.user?.email || (role !== "admin" && role !== "gym")) return res.status(401).json({ error: "Unauthorized" });

  try {
    const snap = await firestore.collection("notification_rules").get();
    const rules = snap.docs.map((d) => ({ key: d.id, ...(d.data() as any) }));
    return    return res.status(200).json({ rules });
  } catch (e: any) {
    console.error("[rules/list]", e?.message || e);
    return res.status(500).json({ error: "Failed to list rules" });
  }
}
