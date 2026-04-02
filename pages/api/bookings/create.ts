import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { hasRole } from "../../../lib/rbac";

type PaymentMethod = "stripe" | "pay_on_day" | "member_free";

const RESERVED_STATUSES = ["confirmed", "pending_payment", "pay_on_day", "member_free"] as const;

function originEmail(session: any): string {
  return String(session?.user?.email || "").trim().toLowerCase();
}

function resolveUid(session: any) {
  const user = session?.user as any;
  return user?.id || user?.uid || user?.email || null;
}

async function isFreeMember(email: string): Promise<boolean> {
  if (!email) return false;
  const snap = await firestore.collection("users").doc(email).get();
  if (!snap.exists) return false;
  const d = snap.data() as any;
  const sub = String(d?.subscription_status || "").toLowerCase();
  const mem = String(d?.membership_status || "").toLowerCase();
  const premium = Boolean(d?.is_premium);
  return premium || sub === "active" || sub === "trialing" || mem === "gym_member";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions).catch(() => null);

  // If signed in, enforce roles. If guest, allow but require guest details.
  if (session && !hasRole(session, ["user", "gym", "admin"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { session_id, payment_method, guest_name, guest_email } = (req.body || {}) as {
    session_id?: string;
    payment_method?: PaymentMethod;
    guest_name?: string;
    guest_email?: string;
  };

  if (!session_id) return res.status(400).json({ error: "session_id is required" });

  const methodRaw = String(payment_method || "").trim() as PaymentMethod;
  if (!["stripe", "pay_on_day", "member_free"].includes(methodRaw)) {
    return res.status(400).json({ error: "payment_method must be stripe | pay_on_day | member_free" });
  }

  const email = session ? originEmail(session) : "";
  const uidFromSession = session ? resolveUid(session) : null;

  const guestName = String(guest_name || "").trim();
  const guestEmail = String(guest_email || "").trim().toLowerCase();

  if (!uidFromSession) {
    if (!guestName) return res.status(400).json({ error: "guest_name is required for guests" });
    if (!guestEmail) return res.status(400).json({ error: "guest_email is required for guests" });
  }

  // If user is a full member, force free booking regardless of client choice
  const memberFree = email ? await isFreeMember(email) : false;
  const method: PaymentMethod = memberFree ? "member_free" : methodRaw;

  const uid = uidFromSession ? String(uidFromSession).trim().toLowerCase() : `guest_${guestEmail}`;
  const bookingId = `${session_id}_${uid}`;

  const now = Timestamp.now();

  try {
    const sessionRef = firestore.collection("session").doc(session_id);
    const bookingRef = firestore.collection("bookings").doc(bookingId);

    const status =
      method === "stripe" ? "pending_payment" :
      method === "pay_on_day" ? "pay_on_day" :
      "confirmed";

    const amount_gbp =
      method === "member_free" ? 0 :
      method === "pay_on_day" ? 10 :
      8;

    await firestore.runTransaction(async (tx) => {
      const sessSnap = await tx.get(sessionRef);
      if (!sessSnap.exists) throw new Error("Session not found");

      const sessData = sessSnap.data() as any;
      const max = Number(sessData?.max_attendance) || 0;

      const reservedSnap = await firestore
        .collection("bookings")
        .where("session_id", "==", session_id)
        .where("status", "in", RESERVED_STATUSES as any)
        .get();

      if (max > 0 && reservedSnap.size >= max) throw new Error("Session is full");

      const existing = await tx.get(bookingRef);
      if (existing.exists) {
        const ex = existing.data() as any;
        if (String(ex?.status) === "confirmed") return;

        tx.set(
          bookingRef,
          {
            status,
            payment_method: method,
            amount_gbp,
            updated_at: now,
          },
          { merge: true }
        );
        return;
      }

      tx.set(bookingRef, {
        booking_id: bookingId,
        session_id,
        user_id: uidFromSession ? uid : null,
        guest_name: uidFromSession ? null : guestName,
        guest_email: uidFromSession ? null : guestEmail,
        status,
        payment_method: method,
        amount_gbp,
        paid: method === "member_free" ? true : false,
        stripe_checkout_session_id: null,
        stripe_payment_intent_id: null,
        source: "schedule",
        created_at: now,
        updated_at: now,
      });
    });

    return res.status(200).json({
      ok: true,
      booking_id: bookingId,
      status,
      payment_method: method,
      amount_gbp,
    });
  } catch (err: any) {
    const msg = err?.message || "Failed to create booking";
    const code = msg === "Session is full" ? 409 : msg === "Session not found" ? 404 : 500;
    return res.status(code).json({ error: msg });
  }
}
