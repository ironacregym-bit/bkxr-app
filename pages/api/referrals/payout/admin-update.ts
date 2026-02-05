// pages/api/referrals/payout/admin-update.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

type Action = "paid" | "rejected";

function origin() {
  return process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
}
async function emitEmail(event: string, email: string, context: Record<string, any> = {}, force = false) {
  const BASE = origin();
  if (!BASE || !email) return;
  await fetch(`${BASE}/api/notify/emit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, email, context, force }),
  }).catch(() => null);
}
async function notifyAdmins(event: string, context: Record<string, any> = {}) {
  const list = (process.env.NOTIFY_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  await Promise.all(list.map((email) => emitEmail(event, email, context)));
}

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
    const referrerEmail = String(payout.referrer_email || "");
    const amountGBP = Number(payout.amount_gbp || 0);

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
          if (String(e?.payout_id || "") !== payoutRef.id) return e;

          if (action === "paid" && e?.status === "requested") {
            return { ...e, status: "paid", paid_at: new Date().toISOString() };
          }
          if (action === "rejected" && (e?.status === "requested" || e?.status === "paid")) {
            const { payout_id: _omit, requested_at: _omit2, paid_at: _omit3, transfer_id: _omit4, ...rest } = e || {};
            return { ...rest, status: "unpaid", reverted_at: new Date().toISOString() };
          }
          return e;
        });

        tx.set(docRef, { commission_entries: updated }, { merge: true });
      }

      // Update payout document
      const base: any = { status: action, updated_at: new Date().toISOString() };
      if (action === "paid") base.paid_at = new Date().toISOString();
      if (action === "rejected") base.rejected_at = new Date().toISOString();

      tx.set(payoutRef, base, { merge: true });
    });

    // Notify referrer + admins
    if (referrerEmail) {
      await emitEmail(
        action === "paid" ? "referral_payout_marked_paid" : "referral_payout_rejected",
        referrerEmail,
        { payout_id, amount_gbp: amountGBP }
      );
    }
    await notifyAdmins(
      action === "paid" ? "admin_referral_payout_marked_paid" : "admin_referral_payout_rejected",
      { payout_id, referrer_email: referrerEmail, amount_gbp: amountGBP }
    );

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
