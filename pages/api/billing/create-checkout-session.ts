
// pages/api/billing/create-checkout-session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
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

    // Try to reuse an existing stripe_customer_id from Firestore
    const userRef = firestore.collection("users").doc(email);
    const snap = await userRef.get();
    const userData = snap.exists ? snap.data() ?? {} : {};
    let stripeCustomerId = userData?.stripe_customer_id as string | undefined;

    if (!stripeCustomerId) {
      // Create a new Stripe Customer
      const customer = await stripe.customers.create({ email });
      stripeCustomerId = customer.id;

      await userRef.set(
        {
          email,
          stripe_customer_id: stripeCustomerId,
          billing_plan: "online_monthly",
          created_via_provider: session?.user ? "google" : "email",
        },
        { merge: true }
      );
    }

    // Create Checkout Session: 14-day trial, no card if amount today is £0
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID_MONTHLY_20!,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        trial_settings: {
          end_behavior: {
            // Choose "pause" or "cancel" if trial ends with no card (pause recommended)
            missing_payment_method: "pause",
          },
        },
      },
      payment_method_collection: "if_required",
      success_url: `${process.env.NEXTAUTH_URL}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/billing/cancelled`,
    });

    return res.status(200).json({ url: checkoutSession.url });
  } catch (e: any) {
    console.error("[create-checkout-session] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to create checkout session    return res.status(500).json({ error: e?.message || "Failed to create checkout session" });
  }
}
