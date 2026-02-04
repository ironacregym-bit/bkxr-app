// pages/api/referrals/payout/request-connect.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";
import { stripe } from "../../../../lib/stripe";

const MIN_PAYOUT = Number(process.env.MIN_PAYOUT_GBP || 20);

type TargetEntry = { refDocId: string; idx: number; invoice_id: string; amount: number };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Load user to get connected account id
    const userRef = firestore.collection("users").doc(email);
    const userSnap = await userRef.get();
    const user = userSnap.exists ? (userSnap.data() || {}) : {};
    const accountId = user?.stripe_connect_id as string | undefined;
    if (!accountId) return res.status(400).json({ error: "You must set up payouts first." });

    // Compute unpaid commission entries
    const refSnap = await firestore.collection("referrals").where("referrer_email", "==", email).get();
    const targets: TargetEntry[] = [];
    let total = 0;

    for (const doc of refSnap.docs) {
      const d = doc.data() || {};
      const entries: any[] = Array.isArray(d.commission_entries) ? d.commission_entries : [];
      entries.forEach((e, idx) => {
        if (e?.status === "unpaid" && typeof e.amount === "number" && e.amount > 0) {
          total += e.amount;
          targets.push({ refDocId: doc.id, idx, invoice_id: String(e.invoice_id || ""), amount: Number(e.amount || 0) });
        }
      });
    }

    total = Number(total.toFixed(2));
    if (total < MIN_PAYOUT) {
      return res.status(400).json({ error: `Minimum payout is £${MIN_PAYOUT.toFixed(2)}`, total });
    }

    // Create a Transfer to the connected account (amount in pence)
    const amountPence = Math.round(total * 100);
    const transfer = await stripe.transfers.create({
      amount: amountPence,
      currency: "gbp",
      destination: accountId,
      metadata: {
        referrer_email: email,
        purpose: "referral_payout",
      },
    });

    // Create payout doc and lock entries to "requested" with transfer_id (in a transaction)
    const payoutRef = firestore.collection("referral_payouts").doc();
    await firestore.runTransaction(async (tx) => {
      // lock per referrals doc
      const grouped = groupBy(targets, t => t.refDocId);
      for (const g of grouped) {
        const docRef = firestore.collection("referrals").doc(g.key);
        const snap = await tx.get(docRef);
        if (!snap.exists) continue;
        const d = snap.data() || {};
        const arr: any[] = Array.isArray(d.commission_entries) ? d.commission_entries : [];
        const updated = arr.map((e, i) => {
          const match = g.items.find(m => m.idx === i && e?.invoice_id === m.invoice_id && e?.status === "unpaid");
          if (match) return { ...e, status: "requested", requested_at: new Date().toISOString(), payout_id: payoutRef.id, transfer_id: transfer.id };
          return e;
        });
        tx.set(docRef, { commission_entries: updated }, { merge: true });
      }

      tx.set(payoutRef, {
        referrer_email: email,
        amount_gbp: total,
        currency: "GBP",
        status: "pending", // you can update to 'paid' via webhook or admin action
        created_at: new Date().toISOString(),
        transfer_id: transfer.id,
        stripe_connect_id: accountId,
        entries: targets.map(t => ({ referral_doc_id: t.refDocId, invoice_id: t.invoice_id, amount: t.amount })),
      });
    });

    return res.status(200).json({ ok: true, payout_id: payoutRef.id, amount_gbp: total, transfer_id: transfer.id });
  } catch (e: any) {
    console.error("[payout/request-connect] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to request payout" });
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
