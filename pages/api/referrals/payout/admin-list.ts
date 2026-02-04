// pages/api/referrals/payout/admin-list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const role = (session?.user as any)?.role || "user";
  if (!session?.user?.email || (role !== "admin" && role !== "gym")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const status = String(req.query.status || "").toLowerCase();
    let q = firestore.collection("referral_payouts").orderBy("created_at", "desc");
    if (status && ["pending", "approved", "paid", "rejected"].includes(status)) {
      q = q.where("status", "==", status);
    }
    const snap = await q.get();
    const payouts = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    return res.status(200).json({ payouts });
  } catch (e: any) {
    console.error("[admin-list] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to list payouts" });
  }
}
