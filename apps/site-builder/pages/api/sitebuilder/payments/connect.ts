import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { firestore } from "@pt/firebase";
import { isSiteOwner } from "@/lib/sitebuilder/access";
import { siteIdSchema } from "@/lib/sitebuilder/payments";
import { getSiteBuilderStripe } from "@/lib/sitebuilder/stripe";
import { nowIso } from "@/lib/sitebuilder/model";

const requestSchema = z.object({ siteId: siteIdSchema });

function siteBuilderOrigin() {
  const configuredOrigin = process.env.NEXTAUTH_URL;
  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).origin;
    } catch {
      return "";
    }
  }

  const host = String(process.env.SITEBUILDER_BASE_HOST || "").trim().toLowerCase();
  return host ? `https://${host.replace(/^https?:\/\//, "").split("/")[0]}` : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = String(session?.user?.email || "").trim().toLowerCase();
  if (!email) return res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });

  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_REQUEST" });

  try {
    const siteRef = firestore.collection("sitebuilder_sites").doc(parsed.data.siteId);
    const snapshot = await siteRef.get();
    if (!snapshot.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const site = snapshot.data() || {};
    if (!isSiteOwner(site, email)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const stripe = getSiteBuilderStripe();
    let accountId = String(site.payments?.stripeAccountId || "");
    if (!accountId) {
      const country = String(process.env.SITEBUILDER_STRIPE_ACCOUNT_COUNTRY || "GB").toUpperCase();
      if (!/^[A-Z]{2}$/.test(country)) {
        return res.status(500).json({ ok: false, error: "INVALID_STRIPE_ACCOUNT_COUNTRY" });
      }

      const account = await stripe.accounts.create(
        {
          type: "express",
          country,
          email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        },
        { idempotencyKey: `sitebuilder_connect_${parsed.data.siteId}` }
      );
      accountId = account.id;
      await siteRef.update({
        tenantId: parsed.data.siteId,
        "payments.stripeAccountId": accountId,
        updated_at: nowIso(),
      });
    }

    const account = await stripe.accounts.retrieve(accountId);
    if (account.details_submitted && account.charges_enabled) {
      const loginLink = await stripe.accounts.createLoginLink(accountId);
      return res.status(200).json({ ok: true, connected: true, url: loginLink.url });
    }

    const origin = siteBuilderOrigin();
    if (!origin) return res.status(500).json({ ok: false, error: "SITEBUILDER_ORIGIN_NOT_CONFIGURED" });
    const sitePath = `/sitebuilder/${encodeURIComponent(parsed.data.siteId)}?view=payments`;
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}${sitePath}&stripe=refresh`,
      return_url: `${origin}${sitePath}&stripe=return`,
      type: "account_onboarding",
    });

    return res.status(200).json({ ok: true, connected: false, url: accountLink.url });
  } catch (error) {
    console.error("[sitebuilder/payments/connect] failed:", error);
    return res.status(500).json({ ok: false, error: "STRIPE_CONNECT_FAILED" });
  }
}
