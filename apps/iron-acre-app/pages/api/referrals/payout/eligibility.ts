// pages/api/referrals/payout/eligibility.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const snap = await firestore.collection("referrals").where("referrer_email", "==", email).get();
    let total = 0;
    const entries: { referral_doc_id: string; invoice_id: string; amount: number; month?: string }[] = [];

    for (const doc of snap.docs) {
      const d = doc.data() || {};
      const list: any[] = Array.isArray(d.commission_entries) ? d.commission_entries : [];
      for (const e of list) {
        if (e?.status === "unpaid" && typeof e.amount === "number" && e.amount > 0) {
          total += e.amount;
          entries.push({ referral_doc_id: doc.id, invoice_id: String(e.invoice_id || ""), amount: Number(e.amount || 0), month: e.month });
        }
      }
    }

    return res.status(200).json({ currency: "GBP", total, entries });
  } catch (e: any) {
    console.error("[payout/eligibility] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to compute eligibility" });
  }
}
