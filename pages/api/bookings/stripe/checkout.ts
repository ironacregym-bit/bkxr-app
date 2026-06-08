// pages/api/bookings/stripe/checkout.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

function baseFromReq(req: NextApiRequest) {
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    (req.headers["x-forwarded-protocol"] as string) ||
    "https";

  const host =
    (req.headers["x-forwarded-host"] as string) ||
    (req.headers.host as string) ||
    "";

  if (!host) return process.env.NEXTAUTH_URL || "";
  return `${proto}://${host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

 Here’s the **full updated file** for `pages/api/bookings/stripe/checkout.ts`.

This version:
- changes the prebook price to **£9**
- changes the product name to **Iron Acre Session Prebook**
- uses the **booking amount** if present, so the route stays in sync with booking creation rather than relying on another hard-coded value
- uses the **request host** for success/cancel URLs instead of relying only on `NEXTAUTH_URL`
- blocks checkout if the booking is not a Stripe class booking

```ts
// pages/api/bookings/stripe/checkout.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

function baseFromReq(req: NextApiRequest) {
  const proto =
    (req.headers["x-forwarded-proto"] as string) ||
    (req.headers["x-forwarded-protocol"] as string) ||
    "https";

  const host =
    (req.headers["x-forwarded-host"] as string) ||
    (req.headers.host as string) ||
    "";

  if (!host) return "";
  return `${proto}://${host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { booking_id } = req.body as { booking_id?: string };

  if (!booking_id) {
    return res.status(400).json({ error: "booking_id is required" });
  }

  try {
    const bookingRef = firestore.collection("bookings").doc(booking_id);
    const bSnap = await bookingRef.get();

    if (!bSnap.exists) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = bSnap.data() as any;

    if (String(booking?.status || "") !== "pending_payment") {
      return res.status(400).json({ error: "Booking is not pending payment" });
    }

    if (String(booking?.payment_method || "") !== "stripe") {
      return res.status(400).json({ error: "Booking is not a Stripe prebook booking" });
    }

    const amountGbp = Number(booking?.amount_gbp || 9);
    const unitAmountPence = Math.round(amountGbp * 100);

    if (!Number.isFinite(unitAmountPence) || unitAmountPence <= 0) {
      return res.status(400).json({ error: "Invalid booking amount" });
    }

    const baseUrl = baseFromReq(req) || process.env.NEXTAUTH_URL || "";

    if (!baseUrl) {
      return res.status(500).json({ error: "Could not determine application base URL" });
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: booking?.user_email || booking?.guest_email || undefined,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: unitAmountPence,
            product_data: {
              name: "Iron Acre Session Prebook",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        booking_id,
        session_id: String(booking?.session_id || ""),
        booking_type: "class_prebook",
      },
      success_url: `${baseUrl}/book/success?booking_id=${encodeURIComponent(booking_id)}`,
      cancel_url: `${baseUrl}/book/cancel?booking_id=${encodeURIComponent(booking_id)}`,
    });

    await bookingRef.set(
      {
        stripe_checkout_session_id: checkout.id,
        updated_at: Timestamp.now(),
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      url: checkout.url,
    });
  } catch (e: any) {
    return res.status(500).json({
      error: e?.message || "Failed to create checkout session",
    });
  }
}
