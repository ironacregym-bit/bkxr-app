import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { firestore } from "@pt/firebase";
import { isSiteOwner } from "@/lib/sitebuilder/access";
import { paymentProductsPatchSchema, siteIdSchema } from "@/lib/sitebuilder/payments";
import { nowIso } from "@/lib/sitebuilder/model";
import { getSiteBuilderStripe } from "@/lib/sitebuilder/stripe";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = String(session?.user?.email || "").trim().toLowerCase();
  if (!email) return res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });

  const siteId = req.method === "GET" ? siteIdSchema.safeParse(req.query.siteId) : null;
  const body = req.method === "POST" ? paymentProductsPatchSchema.safeParse(req.body) : null;
  if ((siteId && !siteId.success) || (body && !body.success)) {
    return res.status(400).json({ ok: false, error: "INVALID_REQUEST" });
  }
  const cleanSiteId = body?.success ? body.data.siteId : siteId?.success ? siteId.data : "";

  try {
    const ref = firestore.collection("sitebuilder_sites").doc(cleanSiteId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const site = snapshot.data() || {};
    if (!isSiteOwner(site, email)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    if (req.method === "GET") {
      const payments = site.payments || {};
      return res.status(200).json({
        ok: true,
        enabled: Boolean(payments.enabled),
        products: Array.isArray(payments.products) ? payments.products : [],
      });
    }

    if (!body?.success) return res.status(400).json({ ok: false, error: "INVALID_REQUEST" });
    const payments = body.data;
    if (payments.enabled) {
      const accountId = String(site.payments?.stripeAccountId || "");
      if (!accountId) {
        return res.status(409).json({ ok: false, error: "STRIPE_ACCOUNT_NOT_CONNECTED" });
      }
      const account = await getSiteBuilderStripe().accounts.retrieve(accountId);
      if (!account.charges_enabled) {
        return res.status(409).json({ ok: false, error: "STRIPE_ACCOUNT_NOT_READY" });
      }
    }

    await ref.update({
      tenantId: cleanSiteId,
      "payments.enabled": payments.enabled,
      "payments.products": payments.products,
      updated_at: nowIso(),
    });

    return res.status(200).json({ ok: true, enabled: payments.enabled, products: payments.products });
  } catch (error) {
    console.error("[sitebuilder/payments/products] failed:", error);
    return res.status(500).json({ ok: false, error: "PAYMENT_PRODUCTS_FAILED" });
  }
}
