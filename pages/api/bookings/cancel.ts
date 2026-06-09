// pages/api/bookings/cancel.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { FieldValue, Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { hasRole } from "../../../lib/rbac";
import { stripe } from "../../../lib/stripe";

type ActiveBookingStatus = "confirmed" | "pending_payment" | "pay_on_day" | "member_free";

type CancelledBookingStatus =
  | "cancelled_refunded"
  | "cancelled_no_refund"
  | "cancelled_pay_on_day"
  | "cancelled_member";

type CancelPaymentMethod = "stripe" | "pay_on_day" | "member_free";

type CancelResponse =
  | {
      ok: true;
      booking_id: string;
      status: CancelledBookingStatus;
      payment_method: CancelPaymentMethod;
      refunded: boolean;
      refund_amount_gbp: number;
      was_late_cancel: boolean;
      refund_cutoff_passed: boolean;
    }
  | {
      error: string;
    };

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
  const base = baseFromReq(req);
  if (!base || !email) return;

  await fetch(`${base}/api/notify/emit`, {
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

function subtract24Hours(d: Date) {
  return new Date(d.getTime() - 24 * 60 * 60 * 1000);
}

function isActiveStatus(status: string): status is ActiveBookingStatus {
  return ["confirmed", "pending_payment", "pay_on_day", "member_free"].includes(status);
}

async function resolveSessionSnapshotData(booking: any) {
  const storedStart = asDate(booking?.session_start_at) || asDate(booking?.start_time);
  const storedCutoff = asDate(booking?.refund_cutoff_at);

  if (storedStart) {
    return {
      sessionStart: storedStart,
      refundCutoff: storedCutoff || subtract24Hours(storedStart),
      classId: String(booking?.class_id || "").trim() || null,
      className: String(booking?.class_name || "").trim() || null,
      gymName: String(booking?.gym_name || "").trim() || null,
    };
  }

  const sessionId = String(booking?.session_id || "").trim();
  if (!sessionId) {
    return {
      sessionStart: null,
      refundCutoff: null,
      classId: String(booking?.class_id || "").trim() || null,
      className: String(booking?.class_name || "").trim() || null,
      gymName: String(booking?.gym_name || "").trim() || null,
    };
  }

  const sessionSnap = await firestore.collection("session").doc(sessionId).get();
  if (!sessionSnap.exists) {
    return {
      sessionStart: null,
      refundCutoff: null,
      classId: String(booking?.class_id || "").trim() || null,
      className: String(booking?.class_name || "").trim() || null,
      gymName: String(booking?.gym_name || "").trim() || null,
    };
  }

  const sessionData = sessionSnap.data() as any;
  const sessionStart = asDate(sessionData?.start_time);
  const refundCutoff = sessionStart ? subtract24Hours(sessionStart) : null;

  return {
    sessionStart,
    refundCutoff,
    classId:
      String(booking?.class_id || "").trim() ||
      String(sessionData?.class_id || "").trim() ||
      null,
    className:
      String(booking?.class_name || "").trim() ||
      String(sessionData?.class_name || "").trim() ||
      String(sessionData?.class_id || "").trim() ||
      null,
    gymName:
      String(booking?.gym_name || "").trim() ||
      String(sessionData?.gym_name || "").trim() ||
      null,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CancelResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions).catch(() => null);

  if (!session || !hasRole(session, ["user", "gym", "admin"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const authEmail = originEmail(session);
  const authUid = resolveUid(session);

  if (!authEmail && !authUid) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { booking_id, cancel_reason } = (req.body || {}) as {
    booking_id?: string;
    cancel_reason?: string;
  };

  const bookingId = String(booking_id || "").trim();
  const cancelReason = String(cancel_reason || "").trim() || null;

  if (!bookingId) {
    return res.status(400).json({ error: "booking_id is required" });
  }

  try {
    const bookingRef = firestore.collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const booking = bookingSnap.data() as any;

    const bookingStatus = String(booking?.status || "").trim().toLowerCase();
    const paymentMethod = String(booking?.payment_method || "").trim().toLowerCase() as CancelPaymentMethod;

    const isAdminOrGym = hasRole(session, ["admin", "gym"]);
    const bookingUserEmail = String(booking?.user_email || "").trim().toLowerCase();
    const bookingUserId = String(booking?.user_id || "").trim().toLowerCase();
    const callerUid = String(authUid || "").trim().toLowerCase();

    const ownsBooking =
      (bookingUserEmail && bookingUserEmail === authEmail) ||
      (bookingUserId && bookingUserId === callerUid);

    if (!ownsBooking && !isAdminOrGym) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!isActiveStatus(bookingStatus)) {
      return res.status(409).json({ error: "Booking is not cancellable" });
    }

    const resolved = await resolveSessionSnapshotData(booking);

    if (!resolved.sessionStart) {
      return res.status(400).json({ error: "Booking is missing session start time" });
    }

    const nowDate = new Date();
    const refundCutoff = resolved.refundCutoff || subtract24Hours(resolved.sessionStart);
    const refundCutoffPassed = nowDate >= refundCutoff;
    const wasLateCancel = refundCutoffPassed;

    let nextStatus: CancelledBookingStatus;
    let refunded = false;
    let refundAmountGbp = 0;
    let stripeRefundId: string | null = null;
    let refundStatus: "none" | "pending" | "succeeded" | "failed" = "none";

    if (paymentMethod === "member_free") {
      nextStatus = "cancelled_member";
    } else if (paymentMethod === "pay_on_day") {
      nextStatus = "cancelled_pay_on_day";
    } else {
      const isStripeBooking = paymentMethod === "stripe";
      const isPaidBooking = bookingStatus === "confirmed" && Boolean(booking?.paid);

      if (isStripeBooking && isPaidBooking && !refundCutoffPassed) {
        const chargeId = String(booking?.stripe_charge_id || "").trim();
        const paymentIntentId = String(booking?.stripe_payment_intent_id || "").trim();

        if (!chargeId && !paymentIntentId) {
          return res.status(409).json({ error: "Cannot refund because payment reference is missing" });
        }

        const refund = await stripe.refunds.create(
          chargeId ? { charge: chargeId } : { payment_intent: paymentIntentId }
        );

        refunded = true;
        refundAmountGbp = Number(booking?.amount_gbp || 0);
        stripeRefundId = refund.id;
        refundStatus = refund.status === "succeeded" ? "succeeded" : "pending";
        nextStatus = "cancelled_refunded";
      } else {
        nextStatus = "cancelled_no_refund";
      }
    }

    const nowTs = Timestamp.now();
    const recipient = String(booking?.guest_email || booking?.user_email || "")
      .trim()
      .toLowerCase();

    await firestore.runTransaction(async (tx) => {
      tx.set(
        bookingRef,
        {
          status: nextStatus,
          cancelled_at: nowTs,
          cancelled_by: authEmail || callerUid || "unknown",
          cancel_reason: cancelReason,
          updated_at: nowTs,
          class_id: resolved.classId,
          class_name: resolved.className,
          gym_name: resolved.gymName,
          session_start_at: asTimestamp(booking?.session_start_at) || Timestamp.fromDate(resolved.sessionStart as Date),
          refund_cutoff_at: asTimestamp(booking?.refund_cutoff_at) || Timestamp.fromDate(refundCutoff),
          was_late_cancel: wasLateCancel,
          refund_eligible: paymentMethod === "stripe" && !refundCutoffPassed,
          refund_status: refundStatus,
          stripe_refund_id: stripeRefundId,
          amount_refunded_gbp: refundAmountGbp,
        },
        { merge: true }
      );

      const bookingUserDocKey = bookingUserEmail || null;

      if (bookingUserDocKey) {
        const userRef = firestore.collection("users").doc(bookingUserDocKey);

        const userUpdate: Record<string, any> = {
          cancellation_count_total: FieldValue.increment(1),
          last_cancelled_at: nowTs,
        };

        if (nextStatus === "cancelled_no_refund" && paymentMethod === "stripe" && wasLateCancel) {
          userUpdate.late_cancellation_count_total = FieldValue.increment(1);
        }

        if (nextStatus === "cancelled_refunded") {
          userUpdate.refunded_cancellation_count_total = FieldValue.increment(1);
        }

        if (nextStatus === "cancelled_pay_on_day") {
          userUpdate.pay_on_day_cancellation_count_total = FieldValue.increment(1);
        }

        tx.set(userRef, userUpdate, { merge: true });
      }

      const auditRef = firestore
        .collection("booking_cancellations")
        .doc(`${bookingId}_${nowDate.getTime()}`);

      tx.set(auditRef, {
        booking_id: bookingId,
        session_id: String(booking?.session_id || ""),
        user_id: booking?.user_id || null,
        user_email: bookingUserEmail || null,
        guest_email: String(booking?.guest_email || "").trim().toLowerCase() || null,
        payment_method: paymentMethod,
        previous_status: bookingStatus,
        new_status: nextStatus,
        cancelled_at: nowTs,
        cancelled_by: authEmail || callerUid || "unknown",
        cancel_reason: cancelReason,
        class_id: resolved.classId,
        class_name: resolved.className,
        gym_name: resolved.gymName,
        session_start_at:
          asTimestamp(booking?.session_start_at) || Timestamp.fromDate(resolved.sessionStart as Date),
        refund_cutoff_at:
          asTimestamp(booking?.refund_cutoff_at) || Timestamp.fromDate(refundCutoff),
        refund_cutoff_passed: refundCutoffPassed,
        was_late_cancel: wasLateCancel,
        refunded,
        refund_amount_gbp: refundAmountGbp,
        stripe_refund_id: stripeRefundId,
      });
    });

    if (recipient) {
      await emitEmail(req, "class_booking_cancelled", recipient, {
        booking_id: bookingId,
        session_id: booking?.session_id || "",
        class_id: resolved.classId || "",
        class_name: resolved.className || "",
        gym_name: resolved.gymName || "",
        payment_method: paymentMethod,
        cancelled_status: nextStatus,
        refunded,
        refund_amount_gbp: refundAmountGbp,
        was_late_cancel: wasLateCancel,
        session_start_at:
          booking?.session_start_at || Timestamp.fromDate(resolved.sessionStart as Date),
        note:
          nextStatus === "cancelled_refunded"
            ? `Your £${Number(booking?.amount_gbp || 9)} prebook has been refunded.`
            : nextStatus === "cancelled_no_refund"
            ? "This cancellation was within 24 hours, so no refund was issued."
            : nextStatus === "cancelled_pay_on_day"
            ? "Your pay-on-day booking has been cancelled."
            : "Your class booking has been cancelled.",
      });
    }

    return res.status(200).json({
      ok: true,
      booking_id: bookingId,
      status: nextStatus,
      payment_method: paymentMethod,
      refunded,
      refund_amount_gbp: refundAmountGbp,
      was_late_cancel: wasLateCancel,
      refund_cutoff_passed: refundCutoffPassed,
    });
  } catch (err: any) {
    console.error("[bookings/cancel]", err?.message || err);
    return res.status(500).json({ error: err?.message || "Failed to cancel booking" });
  }
}
