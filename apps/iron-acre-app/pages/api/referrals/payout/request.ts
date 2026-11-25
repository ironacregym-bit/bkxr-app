// pages/api/referrals/payout/request.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";
import { FieldValue } from "@google-cloud/firestore";

const MIN_PAYOUT = Number(process.env.MIN_PAYOUT_GBP || 20);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const refSnap = await firestore.collection("referrals").where("referrer_email", "==", email).get();
    const targets: { refDocId: string; idx: number; invoice_id: string; amount: number }[] = [];
    let total = 0;

    for (const doc of refSnap.docs) {
      const d = doc.data() || {};
      const list: any[] = Array.isArray(d.commission_entries) ? d.commission_entries : [];
      list.forEach((e, idx) => {
        if (e?.status === "unpaid" && typeof e.amount === "number" && e.amount > 0) {
          targets.push({ refDocId: doc.id, idx, invoice_id: String(e.invoice_id || ""), amount: Number(e.amount || 0) });
          total += Number(e.amount || 0);
        }
      });
    }

    total = Number(total.toFixed(2));
    if (total < MIN_PAYOUT) {
      return res.status(400).json({ error: `Minimum payout is £${MIN_PAYOUT.toFixed(2)}`, total });
    }

    // Create payout and mark entries as requested in a transaction
    const payoutRef = firestore.collection("referral_payouts").doc(); // pending record
    await firestore.runTransaction(async (tx) => {
      // Lock entries
      for (const group of groupBy(targets, t => t.refDocId)) {
        const docRef = firestore.collection("referrals").doc(group.key);
        const snap = await tx.get(docRef);
        if (!snap.exists) continue;
        const d = snap.data() || {};
        const arr: any[] = Array.isArray(d.commission_entries) ? d.commission_entries : [];

        // Mark matching 'unpaid' entries -> 'requested'
        const updated = arr.map((e, i) => {
          const match = group.items.find(g => g.idx === i && e?.invoice_id === g.invoice_id && e?.status === "unpaid");
          if (match) return { ...e, status: "requested", requested_at: new Date().toISOString(), payout_id: payoutRef.id };
          return e;
        });

        tx.set(docRef, { commission_entries: updated }, { merge: true });
      }

      tx.set(payoutRef, {
        referrer_email: email,
        amount_gbp: total,
        currency: "GBP",
        status: "pending",       // pending|approved|paid|rejected
        created_at: new Date().toISOString(),
        entries: targets.map(t => ({ referral_doc_id: t.refDocId, invoice_id: t.invoice_id, amount: t.amount })),
      });
    });

    // Update aggregate on user
    await firestore.collection("users").doc(email).set(
      { referral_totals: { last_payout_requested_at: new Date().toISOString() } },
      { merge: true }
    );

    return res.status(200).json({ ok: true, payout_id: payoutRef.id, amount_gbp: total });
  } catch (e: any) {
    console.error("[payout/request] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to request payout" });
  }
}

// small util
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
