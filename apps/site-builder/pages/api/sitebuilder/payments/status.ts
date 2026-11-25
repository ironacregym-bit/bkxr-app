import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { firestore } from "@pt/firebase";
import { isSiteOwner } from "@/lib/sitebuilder/access";
import { siteIdSchema } from "@/lib/sitebuilder/payments";
import { getSiteBuilderStripe, siteBuilderStripeConfigured } from "@/lib/sitebuilder/stripe";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = String(session?.user?.email || "").trim().toLowerCase();
  if (!email) return res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });

  const parsed = siteIdSchema.safeParse(req.query.siteId);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_SITE_ID" });

  try {
    const snapshot = await firestore.collection("sitebuilder_sites").doc(parsed.data).get();
    if (!snapshot.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const site = snapshot.data() || {};
    if (!isSiteOwner(site, email)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const accountId = String(site.payments?.stripeAccountId || "");
    if (!accountId) {
      return res.status(200).json({
        ok: true,
        configured: siteBuilderStripeConfigured(),
        connected: false,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      });
    }

    if (!siteBuilderStripeConfigured()) {
      return res.status(200).json({
        ok: true,
        configured: false,
        connected: false,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      });
    }

    const account = await getSiteBuilderStripe().accounts.retrieve(accountId);
    return res.status(200).json({
      ok: true,
      configured: true,
      connected: Boolean(account.details_submitted && account.charges_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
    });
  } catch (error) {
    console.error("[sitebuilder/payments/status] failed:", error);
    return res.status(500).json({ ok: false, error: "PAYMENTS_STATUS_FAILED" });
  }
}
