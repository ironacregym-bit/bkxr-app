import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

type PaymentMethod = "stripe" | "bank" | "pay_on_day";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await getServerSession(req, res, authOptions);
  const userEmail = auth?.user?.email || null;

  const { session_id, guest_name, guest_email, payment_method } = (req.body || {}) as {
    session_id?: string;
    guest_name?: string;
    guest_email?: string;
    payment_method?: PaymentMethod;
  };

  if (!session_id) return res.status(400).json({ error: "session_id is required" });
  if (!payment_method) return res.status(400).json({ error: "payment_method is required" });

  if (!userEmail) {
    if (!guest_name || !guest_email) {
      return res.status(400).json({ error: "guest_name and guest_email are required for guests" });
    }
  }

  const now = Timestamp.now();
  const sessionRef = firestore.collection("session").doc(session_id);
  const bookingsCol = firestore.collection("bookings");

  const amount_gbp = payment_method === "pay_on_day" ? 10 : 8;

  const who = userEmail
    ? `user_${String(userEmail).toLowerCase()}`
    : `guest_${String(guest_email).toLowerCase()}`;

  const booking_id = `${session_id}_${who}`;

  try {
    await firestore.runTransaction(async (tx) => {
      const sSnap = await tx.get(sessionRef);
      if (!sSnap.exists) throw new Error("Session not found");
      const sData = sSnap.data() as any;

      const max = Number(sData?.max_attendance) || 0;

      // This matches your current approach. If you want perfect no-oversell under concurrency,
      // we can switch to a session.confirmed_count counter later.
      const reservedSnap = await bookingsCol
        .where("session_id", "==", session_id)
        .where("status", "in", ["confirmed", "bank_pending", "pay_on_day", "pending_payment"])
        .get();

      if (max > 0 && reservedSnap.size >= max) throw new Error("Session is full");

      const bookingRef = bookingsCol.doc(booking_id);

      const status =
        payment_method === "stripe"
          ? "pending_payment"
          : payment_method === "bank"
          ? "bank_pending"
          : "pay_on_day";

      tx.set(
        bookingRef,
        {
          booking_id,
          session_id,
          user_id: userEmail,
          guest_name: userEmail ? null : String(guest_name || "").trim(),
          guest_email: userEmail ? null : String(guest_email || "").trim(),
          status,
          payment_method,
          amount_gbp,
          paid: false,
          stripe_checkout_session_id: null,
          stripe_payment_intent_id: null,
          source: "public_booking",
          created_at: now,
          updated_at: now,
        },
        { merge: true }
      );
    });

    return res.status(200).json({ ok: true, booking_id, session_id, payment_method, amount_gbp });
  } catch (e: any) {
    const msg = e?.message || "Failed to reserve booking";
    const code = ["Session not found", "Session is full"].includes(msg) ? 400 : 500;
    return res.status(code).json({ error: msg });
  }
}
