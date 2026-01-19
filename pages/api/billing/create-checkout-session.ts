
// pages/api/billing/create-checkout-session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { stripe } from "../../../lib/stripe";
import firestore from "../../../lib/firestoreClient";

/**
 * Starts a 14-day trial (no card upfront) using Stripe Checkout.
 * After success, we send the user to /onboarding.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const session = await getServerSession(req, res, authOptions);
    const email = session?.user?.email;
    if (!email) return res.status(401).json({ error: "Unauthenticated" });

    const priceId = process.env.STRIPE_PRICE_ID_MONTHLY_20;
    if (!priceId) return res.status(500).json({ error: "Missing STRIPE_PRICE_ID_MONTHLY_20" });

    // Resolve (or create) Stripe customer
    const userRef = firestore.collection("users").doc(email);
    const snap = await userRef.get();
    const userData = snap.exists ? (snap.data() ?? {}) : {};
    let stripeCustomerId = userData?.stripe_customer_id as string | undefined;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({ email });
      stripeCustomerId = customer.id;
      await userRef.set(
        {
          email,
          stripe_customer_id: stripeCustomerId,
          billing_plan: "online_monthly",
          created_via_provider: session?.user ? "google_or_email" : "unknown",
        },
        { merge: true }
      );
    }

    const origin = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    if (!origin) return res.status(500).json({ error: "Missing NEXTAUTH_URL/VERCEL_URL for redirect" });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        trial_settings: { end_behavior: { missing_payment_method: "pause" } }, // pause after trial if no PM
      },
      payment_method_collection: "if_required",
      allow_promotion_codes: true,
      success_url: `${origin}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing?canceled=1`,
    });

    return res.status(200).json({ url: checkoutSession.url });
  } catch (e: any) {
    console.error("[create-checkout-session] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to create checkout session" });
  }
}
