// pages/api/bookings/create.ts
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

async function emitEmail(
  req: NextApiRequest,
  event: string,
  email: string,
  context: Record<string, any> = {},
  force = false
) {
  const BASE = baseFromReq(req);
  if (!BASE || !email) return;

  await fetch(`${BASE}/api/notify/emit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, email, context, force }),
  }).catch(() => null);
}

function asDate(value: any): Date | null {
  if (!value) return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function asTimestamp(value: any): Timestamp | null {
  const d = asDate(value);
  return d ? Timestamp.fromDate(d) : null;
}

type UserFlags = {
  membershipScope: string;
  membershipStatus: string;
  subscriptionStatus: string;
  paymentType: string;
  isIncludedMember: boolean;
  isOnlineOnly: boolean;
  canBookClasses: boolean;
  isCashPayer: boolean;
};

async function getUserFlags(email: string): Promise<UserFlags> {
  const fallback: UserFlags = {
    membershipScope: "none",
    membershipStatus: "none",
    subscriptionStatus: "none",
    paymentType: "",
    isIncludedMember: false,
    isOnlineOnly: false,
    canBookClasses: true,
    isCashPayer: false,
  };

  if (!email) return fallback;

  const snap = await firestore.collection("users").doc(email).get();
  if (!snap.exists) return fallback;

  const d = snap.data() as any;

  const membershipScope = String(d?.membership_scope || d?.program_scope || "none")
    .trim()
    .toLowerCase();

  const membershipStatus = String(d?.membership_status || "none")
    .trim()
    .toLowerCase();

  const subscriptionStatus = String(d?.subscription_status || "none")
    .trim()
    .toLowerCase();

  const paymentType = String(d?.payment_type || "")
    .trim()
    .toLowerCase();

  const isOnlineOnly = membershipScope === "online";

  const isIncludedMember =
    membershipStatus === "gym_member" ||
    ((membershipScope === "gym" || membershipScope === "hybrid") &&
      (subscriptionStatus === "active" || subscriptionStatus === "trialing"));

  return {
    membershipScope,
    membershipStatus,
    subscriptionStatus,
    paymentType,
    isIncludedMember,
    isOnlineOnly,
    canBookClasses: !isOnlineOnly,
    isCashPayer: paymentType === "cash",
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions).catch(() => null);

  if (session && !hasRole(session, ["user", "gym", "admin"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { session_id, payment_method, guest_name, guest_email } = (req.body || {}) as {
    session_id?: string;
    payment_method?: PaymentMethod;
    guest_name?: string;
    guest_email?: string;
  };

  if (!session_id) {
    return res.status(400).json({ error: "session_id is required" });
  }

  const requested = String(payment_method || "").trim() as PaymentMethod;

  if (!["stripe", "pay_on_day", "member_free"].includes(requested)) {
    return res
      .status(400)
      .json({ error: "payment_method must be stripe | pay_on_day | member_free" });
  }

  const email = session ? originEmail(session) : "";
  const uidFromSession = session ? resolveUid(session) : null;

  const guestName = String(guest_name || "").trim();
  const guestEmail = String(guest_email || "").trim().toLowerCase();

  if (!uidFromSession) {
    if (!guestName) {
      return res.status(400).json({ error: "guest_name is required for guests" });
    }
    if (!guestEmail) {
      return res.status(400).json({ error: "guest_email is required for guests" });
    }
  }

  const userFlags = email ? await getUserFlags(email) : null;

  if (userFlags?.isOnlineOnly) {
    return res
      .status(403)
      .json({ error: "Your plan does not include gym class booking." });
  }

  let method: PaymentMethod;

  if (userFlags?.isIncludedMember) {
    method = "member_free";
  } else if (userFlags?.isCashPayer) {
    method = "pay_on_day";
  } else {
    method = requested;
  }

  if (!userFlags?.isIncludedMember && requested === "member_free") {
    return res
      .status(403)
      .json({ error: "Free class booking is only available to eligible gym members." });
  }

  const uid = uidFromSession
    ? String(uidFromSession).trim().toLowerCase()
    : `guest_${guestEmail}`;

  const bookingId = `${session_id}_${uid}`;
  const now = Timestamp.now();

  try {
    const sessionRef = firestore.collection("session").doc(session_id);
    const bookingRef = firestore.collection("bookings").doc(bookingId);

    let sessData: any = null;
    let gymData: any = null;

    await firestore.runTransaction(async (tx) => {
      const sessSnap = await tx.get(sessionRef);
      if (!sessSnap.exists) {
        throw new Error("Session not found");
      }

      sessData = sessSnap.data() as any;

      const gymId = String(sessData?.gym_id || "").trim();
      if (gymId) {
        const gymRef = firestore.collection("gyms").doc(gymId);
        const gymSnap = await tx.get(gymRef);
        gymData = gymSnap.exists ? (gymSnap.data() as any) : null;
      }

      const max = Number(sessData?.max_attendance) || 0;

      const reservedQuery = firestore
        .collection("bookings")
        .where("session_id", "==", session_id)
        .where("status", "in", RESERVED_STATUSES as unknown as string[]);

      const reservedSnap = await tx.get(reservedQuery);

      if (max > 0 && reservedSnap.size >= max) {
        throw new Error("Session is full");
      }

      const sessionStartTs = asTimestamp(sessData?.start_time);
      const sessionStartDate = sessionStartTs?.toDate() || null;
      const refundCutoffTs =
        sessionStartDate
          ? Timestamp.fromDate(new Date(sessionStartDate.getTime() - 24 * 60 * 60 * 1000))
          : null;

      const prebookPrice = Number(sessData?.price || 9);
      const dropInPrice = Number(sessData?.drop_in_price || 12);

      const amount_gbp =
        method === "member_free"
          ? 0
          : method === "pay_on_day"
          ? dropInPrice
          : prebookPrice;

      const status =
        method === "stripe"
          ? "pending_payment"
          : method === "pay_on_day"
          ? "pay_on_day"
          : "confirmed";

      const existing = await tx.get(bookingRef);

      if (existing.exists) {
        const ex = existing.data() as any;
        const existingStatus = String(ex?.status || "").trim().toLowerCase();

        if (
          existingStatus === "confirmed" ||
          existingStatus === "pay_on_day" ||
          existingStatus === "member_free"
        ) {
          return;
        }

        tx.set(
          bookingRef,
          {
            status,
            payment_method: method,
            amount_gbp,
            updated_at: now,
            paid: method === "member_free",
            user_email: uidFromSession ? email : null,
            guest_name: uidFromSession ? null : guestName,
            guest_email: uidFromSession ? null : guestEmail,
            class_id: String(sessData?.class_id || "").trim() || null,
            class_name: String(sessData?.class_name || "").trim() || null,
            gym_id: String(sessData?.gym_id || "").trim() || null,
            gym_name: String(gymData?.name || "").trim() || null,
            session_start_at: sessionStartTs,
            refund_cutoff_at: refundCutoffTs,
            refund_eligible: method === "stripe",
          },
          { merge: true }
        );

        return;
      }

      tx.set(bookingRef, {
        booking_id: bookingId,
        session_id,
        user_id: uidFromSession ? uid : null,
        user_email: uidFromSession ? email : null,
        guest_name: uidFromSession ? null : guestName,
        guest_email: uidFromSession ? null : guestEmail,
        status,
        payment_method: method,
        amount_gbp,
        paid: method === "member_free",
        stripe_checkout_session_id: null,
        stripe_payment_intent_id: null,
        stripe_charge_id: null,
        stripe_refund_id: null,
        refund_status: "none",
        source: "schedule",
        class_id: String(sessData?.class_id || "").trim() || null,
        class_name: String(sessData?.class_name || "").trim() || null,
        gym_id: String(sessData?.gym_id || "").trim() || null,
        gym_name: String(gymData?.name || "").trim() || null,
        created_at: now,
        updated_at: now,
        cancelled_at: null,
        cancelled_by: null,
        cancel_reason: null,
        amount_refunded_gbp: 0,
        session_start_at: sessionStartTs,
        refund_cutoff_at: refundCutoffTs,
        refund_eligible: method === "stripe",
        was_late_cancel: false,
      });
    });

    const recipient = uidFromSession ? email : guestEmail;

    if (recipient) {
      const currentMethod = userFlags?.isIncludedMember
        ? "member_free"
        : userFlags?.isCashPayer
        ? "pay_on_day"
        : requested;

      const prebookPrice = Number(sessData?.price || 9);
      const dropInPrice = Number(sessData?.drop_in_price || 12);
      const amountGbp =
        currentMethod === "member_free"
          ? 0
          : currentMethod === "pay_on_day"
          ? dropInPrice
          : prebookPrice;

      const status =
        currentMethod === "stripe"
          ? "pending_payment"
          : currentMethod === "pay_on_day"
          ? "pay_on_day"
          : "confirmed";

      if (status !== "pending_payment") {
        await emitEmail(req, "class_booking_confirmed", recipient, {
          booking_id: bookingId,
          session_id,
          payment_method: currentMethod,
          amount_gbp: amountGbp,
          class_id: String(sessData?.class_id || "").trim(),
          class_name: String(sessData?.class_name || "").trim(),
          gym_name: String(gymData?.name || "").trim(),
          start_time: sessData?.start_time || null,
          note:
            currentMethod === "member_free"
              ? "Included with your membership"
              : currentMethod === "pay_on_day"
              ? `Pay £${dropInPrice} on arrival`
              : `Prebooked at £${prebookPrice}`,
        });
      }
    }

    const finalMethod = userFlags?.isIncludedMember
      ? "member_free"
      : userFlags?.isCashPayer
      ? "pay_on_day"
      : requested;

    const finalAmount =
      finalMethod === "member_free"
        ? 0
        : finalMethod === "pay_on_day"
        ? Number(sessData?.drop_in_price || 12)
        : Number(sessData?.price || 9);

    const finalStatus =
      finalMethod === "stripe"
        ? "pending_payment"
        : finalMethod === "pay_on_day"
        ? "pay_on_day"
        : "confirmed";

    return res.status(200).json({
      ok: true,
      booking_id: bookingId,
      status: finalStatus,
      payment_method: finalMethod,
      amount_gbp: finalAmount,
      is_member_free: Boolean(userFlags?.isIncludedMember),
      is_cash_payer: Boolean(userFlags?.isCashPayer),
      membership_scope: userFlags?.membershipScope || "none",
      can_book_classes: userFlags?.canBookClasses ?? true,
    });
  } catch (err: any) {
    const msg = err?.message || "Failed to create booking";
    const code =
      msg === "Session is full" ? 409 : msg === "Session not found" ? 404 : 500;

    return res.status(code).json({ error: msg });
  }
}
