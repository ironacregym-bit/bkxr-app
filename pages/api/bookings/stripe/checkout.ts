// pages/api/bookings/stripe/checkout.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2023-10-16" });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { booking_id } = req.body as { booking_id?: string };
  if (!booking_id) return res.status(400).json({ error: "booking_id is required" });

  try {
    const bookingRef = firestore.collection("bookings").doc(booking_id);
    const bSnap = await bookingRef.get();
    if (!bSnap.exists) return res.status(404).json({ error: "Booking not found" });

    const b = bSnap.data() as any;
    if (b.status !== "pending_payment") return res.status(400).json({ error: "Booking is not pending payment" });

    const checkout = await stripe.checkout.sessions.create({
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
      metadata: { booking_id },
      success_url: `${process.env.NEXTAUTH_URL}/book/success?booking_id=${encodeURIComponent(booking_id)}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/book/cancel?booking_id=${encodeURIComponent(booking_id)}`,
    });

    await bookingRef.set(
      {
        stripe_checkout_session_id: checkout.id,
        updated_at: Timestamp.now(),
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true, url: checkout.url });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Failed to create checkout session" });
  }
}
