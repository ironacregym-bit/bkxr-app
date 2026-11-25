
// pages/api/billing/invoices.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";
import { stripe } from "../../../lib/stripe";

/**
 * Returns recent Stripe invoices for the signed-in user's customer.
 * Includes receipt_url, hosted_invoice_url, invoice_pdf when available.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  const limitParam = Number(req.query.limit);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(20, limitParam)) : 10;

  try {
    const email = session.user.email;
    const snap = await firestore.collection("users").doc(email).get();
    const customerId = (snap.data()?.stripe_customer_id as string) || undefined;

    if (!customerId) {
      // No Stripe customer yet (free user or hasn’t checked out)
      return res.status(200).json({ invoices: [] });
    }

    const list = await stripe.invoices.list({ customer: customerId, limit });
    const invoices = list.data.map((inv) => ({
      id: inv.id,
      number: inv.number || null,
      amount_paid: inv.amount_paid ?? null,
      currency: inv.currency || "gbp",
      status: inv.status || null, // paid|open|void|uncollectible
      hosted_invoice_url: inv.hosted_invoice_url || null,
      invoice_pdf: inv.invoice_pdf || null,
      // receipts can be reached via charge. If latest charge exists, fetch receipt_url.
      receipt_url: (inv.charge as any)?.receipt_url || null,
      created: inv.created || null,
    }));

    // If some invoices are missing receipt_url but have a charge id, expand charges to fetch receipt_url.
    // (Keep it simple for now; most paid invoices include hosted_invoice_url or invoice_pdf.)

    return res.status(200).json({ invoices });
  } catch (e: any) {
    console.error("[billing/invoices]", e?.message || e);
    return res.status(500).json({ error: "Failed to load invoices" });
  }
}
