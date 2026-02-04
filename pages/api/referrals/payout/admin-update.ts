// pages/api/referrals/payout/admin-update.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

type Action = "paid" | "rejected";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }

  const session = await getServerSession(req, res, authOptions);
  const role = (session?.user as any)?.role || "user";
  if (!session?.user?.email || (role !== "admin" && role !== "gym")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { payout_id, action } = (req.body || {}) as { payout_id?: string; action?: Action };
  if (!payout_id || !action || !["paid", "rejected"].includes(action)) {
    return res.status(400).json({ error: "payout_id and valid action required" });
  }

  try {
    const payoutRef = firestore.collection("referral_payouts").doc(payout_id);
    const payoutSnap = await payoutRef.get();
    if (!payoutSnap.exists) return res.status(404).json({ error: "Payout not found" });

    const payout = payoutSnap.data() || {};
    const entries: Array<{ referral_doc_id: string; invoice_id: string; amount: number }> = Array.isArray(payout.entries) ? payout.entries : [];

    await firestore.runTransaction(async (tx) => {
      // Update referral docs' commission_entries according to action
      for (const group of groupBy(entries, (x) => x.referral_doc_id)) {
        const docRef = firestore.collection("referrals").doc(group.key);
        const snap = await tx.get(docRef);
        if (!snap.exists) continue;
        const d = snap.data() || {};
        const arr: any[] = Array.isArray(d.commission_entries) ? d.commission_entries : [];

        const updated = arr.map((e) => {
          const match = group.items.find((m) => m.invoice_id === e?.invoice_id);
          if (!match) return e;

          // Only change entries that are still 'requested' for this payout
          if (String(e?.payout_id || "") !== payoutRef.id || e?.status !== "requested") return e;

          if (action === "paid") {
            return { ...e, status: "paid", paid_at: new Date().toISOString() };
          } else {
            // rejected -> revert to unpaid
            const { payout_id: _omit, requested_at: _omit2, transfer_id: _omit3, ...rest } = e || {};
            return { ...rest, status: "unpaid" };
          }
        });

        tx.set(docRef, { commission_entries: updated }, { merge: true });
      }

      // Update payout document
      const base: any = { status: action, updated_at: new Date().toISOString() };
      if (action === "paid") base.paid_at = new Date().toISOString();
      if (action === "rejected") base.rejected_at = new Date().toISOString();

      tx.set(payoutRef, base, { merge: true });
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[admin-update] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to update payout" });
  }
}

function groupBy<T, K extends string | number>(arr: T[], keyFn: (x: T) => K) {
  const map = new Map<K, T[]>();
  for (const item of arr) {
    const k = keyFn(item);
    const list = map.get(k) || [];
    list.push(item);
    map.set(k, list);
  }
  return [...map.entries()].map(([key, items]) => ({ key, items }));
}
