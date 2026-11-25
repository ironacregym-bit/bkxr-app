import type { NextApiRequest, NextApiResponse } from "next";
import { firestore } from "@pt/firebase";
import { checkoutRequestSchema } from "@/lib/sitebuilder/payments";
import { getSiteBuilderStripe } from "@/lib/sitebuilder/stripe";

function normalizeHost(value: string) {
  return String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
}

function checkoutOrigin(req: NextApiRequest, site: any) {
  const requestHost = normalizeHost(
    String(req.headers["x-forwarded-host"] || req.headers.host || "")
  );
  const configuredBases = [
    process.env.SITEBUILDER_BASE_HOST || "",
    ...String(process.env.SITEBUILDER_BASE_HOSTS || "").split(","),
  ]
    .map(normalizeHost)
    .filter(Boolean);
  const customHosts = (Array.isArray(site.domains) ? site.domains : [])
    .filter((domain: any) => ["verified", "active"].includes(String(domain?.status || "")))
    .map((domain: any) => normalizeHost(domain?.host));

  if (requestHost && (configuredBases.includes(requestHost) || customHosts.includes(requestHost))) {
    return `https://${requestHost}`;
  }

  const fallback = String(process.env.NEXTAUTH_URL || "").trim();
  if (fallback) {
    try {
      return new URL(fallback).origin;
    } catch {
      return "";
    }
  }
  return configuredBases[0] ? `https://${configuredBases[0]}` : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const parsed = checkoutRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_REQUEST" });

  try {
    const slugSnapshot = await firestore.collection("sitebuilder_slugs").doc(parsed.data.slug).get();
    if (!slugSnapshot.exists) return res.status(404).json({ ok: false, error: "SITE_NOT_FOUND" });
    const siteId = String(slugSnapshot.data()?.siteId || "").trim();
    if (!siteId) return res.status(404).json({ ok: false, error: "SITE_NOT_FOUND" });

    const siteSnapshot = await firestore.collection("sitebuilder_sites").doc(siteId).get();
    if (!siteSnapshot.exists) return res.status(404).json({ ok: false, error: "SITE_NOT_FOUND" });
    const site = siteSnapshot.data() || {};
    if (site.tenantId !== siteId) return res.status(404).json({ ok: false, error: "SITE_NOT_FOUND" });
    if (!site.published) return res.status(404).json({ ok: false, error: "SITE_NOT_FOUND" });

    const payments = site.payments || {};
    if (!payments.enabled) return res.status(404).json({ ok: false, error: "PAYMENTS_UNAVAILABLE" });
    const accountId = String(payments.stripeAccountId || "");
    if (!accountId) return res.status(409).json({ ok: false, error: "PAYMENTS_NOT_CONNECTED" });

    const product = (Array.isArray(payments.products) ? payments.products : []).find(
      (item: any) => item?.id === parsed.data.productId && item.active === true
    );
    if (!product) return res.status(404).json({ ok: false, error: "PRODUCT_NOT_FOUND" });

    const origin = checkoutOrigin(req, site);
    if (!origin) return res.status(500).json({ ok: false, error: "SITEBUILDER_ORIGIN_NOT_CONFIGURED" });

    const stripe = getSiteBuilderStripe();
    const account = await stripe.accounts.retrieve(accountId);
    if (!account.charges_enabled) {
      return res.status(409).json({ ok: false, error: "STRIPE_ACCOUNT_NOT_READY" });
    }

    const slug = String(site.slug || parsed.data.slug);
    const successUrl = `${origin}/p/${encodeURIComponent(slug)}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/p/${encodeURIComponent(slug)}?checkout=cancelled#payments`;
    const checkout = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: String(product.currency || "gbp"),
              unit_amount: Number(product.amountMinor),
              product_data: {
                name: String(product.name),
                description: String(product.description || "").slice(0, 500) || undefined,
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          siteId,
          siteSlug: slug,
          productId: String(product.id),
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
      { stripeAccount: accountId }
    );

    if (!checkout.url) {
      return res.status(502).json({ ok: false, error: "STRIPE_CHECKOUT_URL_MISSING" });
    }
    return res.status(200).json({ ok: true, url: checkout.url });
  } catch (error) {
    console.error("[sitebuilder/payments/checkout] failed:", error);
    return res.status(500).json({ ok: false, error: "CHECKOUT_CREATION_FAILED" });
  }
}
