import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { stripe } from "../../../lib/stripe";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

function origin() {
  return process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
}

/**
 * POST /api/billing/create-checkout-session
 *
 * Supports two purposes:
 * - subscription (existing behaviour) -> mode=subscription (auth required)
 * - class_booking -> mode=payment (auth NOT required, uses booking_id)
 *
 * Body:
 * {
 *   purpose?: "subscription" | "class_booking";
 *   booking_id?: string; // required for class_booking
 * }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { purpose, booking_id } = (req.body || {}) as {
      purpose?: "subscription" | "class_booking";
      booking_id?: string;
    };

    const BASE = origin();
    if (!BASE) return res.status(500).json({ error: "Missing NEXTAUTH_URL/VERCEL_URL for redirect" });

    const modePurpose = String(purpose || "subscription").toLowerCase();

    /* ----------------------------
       Class booking (one off £8)
       ---------------------------- */
    if (modePurpose === "class_booking") {
      const id = String(booking_id || "").trim();
      if (!id) return res.status(400).json({ error: "booking_id is required for class_booking" });

      const bookingRef = firestore.collection("bookings").doc(id);
      const snap = await bookingRef.get();
      if (!snap.exists) return res.status(404).json({ error: "Booking not found" });

      const b = snap.data() as any;

      if (String(b.status) !== "pending_payment") {
        return res.status(400).json({ error: "Booking is not pending payment" });
      }

      const sessionId = String(b.session_id || "");

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "gbp",
              unit_amount: 800,
              product_data: { name: "BXKR Session Prebook" },
            },
            quantity: 1,
          },
        ],
        metadata: {
          purpose: "class_booking",
          booking_id: id,
          session_id: sessionId,
        },
        success_url: `${BASE}/book/success?booking_id=${encodeURIComponent(id)}`,
        cancel_url: `${BASE}/book/cancel?booking_id=${encodeURIComponent(id)}`,
      });

      await bookingRef.set(
        {
          stripe_checkout_session_id: checkoutSession.id,
          updated_at: Timestamp.now(),
        },
        { merge: true }
      );

      return res.status(200).json({ url: checkoutSession.url, checkout_id: checkoutSession.id });
    }

    /* ----------------------------
       Subscription (existing logic)
       ---------------------------- */
    const session = await getServerSession(req, res, authOptions);
    const email = session?.user?.email;
    if (!email) return res.status(401).json({ error: "Unauthenticated" });

    const priceId = process.env.STRIPE_PRICE_ID_MONTHLY_20;
    if (!priceId) return res.status(500).json({ error: "Missing STRIPE_PRICE_ID_MONTHLY_20" });

    // Resolve (or create) Stripe customer
    const userRef = firestore.collection("users").doc(email);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() ?? {}) : {};
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

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        trial_settings: { end_behavior: { missing_payment_method: "pause" } },
      },
      payment_method_collection: "if_required",
      allow_promotion_codes: true,
      success_url: `${BASE}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE}/billing?canceled=1`,
    });

    return res.status(200).json({ url: checkoutSession.url });
  } catch (e: any) {
    console.error("[create-checkout-session] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to create checkout session" });
  }
}
