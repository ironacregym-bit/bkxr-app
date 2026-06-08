// pages/api/billing/webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "../../../lib/stripe";
import type Stripe from "stripe";
import firestore from "../../../lib/firestoreClient";
import { FieldValue, Timestamp } from "@google-cloud/firestore";

export const config = {
  api: { bodyParser: false },
};

function buffer(readable: any): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: any[] = [];
    readable.on("data", (chunk: any) =>
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    );
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

function appBaseUrl() {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

async function emitEmail(
  event: string,
  email: string,
  context: Record<string, any> = {},
  force = false
) {
  const BASE = appBaseUrl();
  if (!BASE || !email) return;

  await fetch(`${BASE}/api/notify/emit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, email, context, force }),
  }).catch(() => null);
}

async function notifyAdmins(event: string, context: Record<string, any> = {}) {
  const list = (process.env.NOTIFY_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await Promise.all(list.map((email) => emitEmail(event, email, context)));
}

async function getCustomerEmail(customerId: string): Promise<string | undefined> {
  try {
    const c = await stripe.customers.retrieve(customerId);
    return (c as any)?.email as string | undefined;
  } catch {
    return undefined;
  }
}

function trialEndIsoFrom(sub: Stripe.Subscription): string | null {
  return sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
}

function isPremiumFromStatus(status: string): boolean {
  return status === "active" || status === "trialing";
}

async function emitUpgradeCta(email: string) {
  const BASE = appBaseUrl();
  if (!BASE) return;

  await fetch(`${BASE}/api/notify/emit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "upgrade_cta",
      email,
      context: { reason: "subscription_status" },
      force: false,
    }),
  }).catch(() => null);
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function computeCommissionRate(activeCount: number): number {
  if (activeCount >= 50) return 0.3;
  if (activeCount >= 40) return 0.25;
  if (activeCount >= 30) return 0.2;
  if (activeCount >= 20) return 0.15;
  if (activeCount >= 10) return 0.1;
  return 0.05;
}

async function alreadyProcessed(eventId: string) {
  const ref = firestore.collection("stripe_events").doc(eventId);
  const snap = await ref.get();
  if (snap.exists) return true;

  await ref.set({ received_at: new Date().toISOString() });
  return false;
}

function hasTrialExpired(trialEndIso: string | null): boolean {
  if (!trialEndIso) return false;
  const t = Date.parse(trialEndIso);
  if (Number.isNaN(t)) return false;
  return Date.now() >= t;
}

function groupBy<T, K extends string | number>(arr: T[], keyFn: (x: T) => K) {
  const map = new Map<K, T[]>();

  for (const item of arr) {
    const k = keyFn(item);
    const list = map.get(k) || [];
    list.push(item);
    map.set(k, list);
  }

  return [...map.entries()].map(([key, items]) => ({ key, items }));
}

async function findBookingByChargeOrPaymentIntent(charge: Stripe.Charge) {
  const chargeId = String(charge.id || "").trim();
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : "";

  if (chargeId) {
    const byCharge = await firestore
      .collection("bookings")
      .where("stripe_charge_id", "==", chargeId)
      .limit(1)
      .get();

    if (!byCharge.empty) {
      return byCharge.docs[0];
    }
  }

  if (paymentIntentId) {
    const byPi = await firestore
      .collection("bookings")
      .where("stripe_payment_intent_id", "==", paymentIntentId)
      .limit(1)
      .get();

    if (!byPi.empty) {
      return byPi.docs[0];
    }
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"];
  if (!sig) {
    return res.status(400).send("Missing stripe-signature header");
  }

  let event: Stripe.Event;

  try {
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (e: any) {
    console.error("[webhook] signature verification failed:", e?.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  try {
    try {
      if (await alreadyProcessed(event.id)) {
        return res.status(200).json({ received: true, duplicate: true });
      }
    } catch (e: any) {
      console.warn("[webhook] idempotency guard issue:", e?.message || e);
    }

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const email = await getCustomerEmail(customerId);
        if (!email) break;

        const status = sub.status as string;
        const trialEndIso = trialEndIsoFrom(sub);
        const premium = isPremiumFromStatus(status);

        const baseUpdate: Record<string, any> = {
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          subscription_status: status,
          trial_end: trialEndIso,
          is_premium: premium,
          last_billing_event_at: new Date().toISOString(),
          billing_plan: "online_monthly",
        };

        if (!premium && hasTrialExpired(trialEndIso)) {
          baseUpdate.membership_status = "expired";
        }

        await firestore.collection("users").doc(email).set(baseUpdate, { merge: true });

        if (!premium) {
          await emitUpgradeCta(email);
          if (hasTrialExpired(trialEndIso)) {
            await emitEmail("trial_expired", email, { trial_end: trialEndIso });
          }
        }

        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const email = await getCustomerEmail(customerId);
        const subscriptionId =
          typeof invoice.subscription === "string" ? invoice.subscription : undefined;

        if (!email) break;

        await firestore.collection("users").doc(email).set(
          {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: "active",
            is_premium: true,
            membership_status: FieldValue.delete(),
            last_billing_event_at: new Date().toISOString(),
          },
          { merge: true }
        );

        try {
          const refSnap = await firestore
            .collection("referrals")
            .where("referred_email", "==", email)
            .limit(1)
            .get();

          if (refSnap.empty) break;

          const refDoc = refSnap.docs[0];
          const ref = refDoc.data() || {};
          const referrerEmail = String(ref.referrer_email || "");
          if (!referrerEmail) break;

          const month = currentMonth();
          const invoiceAmount = (invoice.total || 0) / 100;

          const existingEntries: Array<any> = Array.isArray(ref.commission_entries)
            ? ref.commission_entries
            : [];

          const duplicate = existingEntries.some((e) => e?.invoice_id === invoice.id);
          if (duplicate) break;

          await refDoc.ref.set(
            {
              converted_to_paid: true,
              subscription_status: "active",
            },
            { merge: true }
          );

          const activePaidSnap = await firestore
            .collection("referrals")
            .where("referrer_email", "==", referrerEmail)
            .where("converted_to_paid", "==", true)
            .get();

          const activePaidCount = activePaidSnap.size;
          const rate = computeCommissionRate(activePaidCount);
          const commission = Number((invoiceAmount * rate).toFixed(2));

          await refDoc.ref.set(
            {
              current_commission_rate: rate,
              commission_total_earned: FieldValue.increment(commission),
              commission_entries: FieldValue.arrayUnion({
                month,
                amount: commission,
                invoice_id: invoice.id,
                status: "unpaid",
                created_at: new Date().toISOString(),
              }),
            },
            { merge: true }
          );

          await firestore.collection("users").doc(referrerEmail).set(
            {
              referral_totals: {
                total_signups: FieldValue.increment(0),
                active_paid: activePaidCount,
                commission_rate: rate,
                total_earned: FieldValue.increment(commission),
              },
            },
            { merge: true }
          );
        } catch (err) {
          console.error("[webhook] referral commission error:", err);
        }

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const email = await getCustomerEmail(customerId);
        const subscriptionId =
          typeof invoice.subscription === "string" ? invoice.subscription : undefined;

        if (!email) break;

        const update: Record<string, any> = {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: "past_due",
          is_premium: false,
          last_billing_event_at: new Date().toISOString(),
        };

        const userSnap = await firestore.collection("users").doc(email).get();
        const trialEnd = (userSnap.data()?.trial_end as string) || null;

        if (hasTrialExpired(trialEnd)) {
          update.membership_status = "expired";
          await emitEmail("trial_expired", email, { trial_end: trialEnd });
        }

        await firestore.collection("users").doc(email).set(update, { merge: true });
        await emitUpgradeCta(email);

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const email = await getCustomerEmail(customerId);
        if (!email) break;

        await firestore.collection("users").doc(email).set(
          {
            subscription_status: "canceled",
            is_premium: false,
            membership_status: "expired",
            last_billing_event_at: new Date().toISOString(),
          },
          { merge: true }
        );

        await emitUpgradeCta(email);
        await emitEmail("trial_expired", email, { reason: "subscription_canceled" });

        break;
      }

      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        const transferId = transfer.id;

        const paySnap = await firestore
          .collection("referral_payouts")
          .where("transfer_id", "==", transferId)
          .limit(1)
          .get();

        if (paySnap.empty) break;

        const payoutRef = paySnap.docs[0].ref;
        const payout = paySnap.docs[0].data() || {};
        if (payout.status === "paid") break;

        const entries: Array<{ referral_doc_id: string; invoice_id: string; amount: number }> =
          Array.isArray(payout.entries) ? payout.entries : [];

        await firestore.runTransaction(async (tx) => {
          for (const group of groupBy(entries, (e) => e.referral_doc_id)) {
            const docRef = firestore.collection("referrals").doc(group.key);
            const snap = await tx.get(docRef);
            if (!snap.exists) continue;

            const d = snap.data() || {};
            const arr: any[] = Array.isArray(d.commission_entries) ? d.commission_entries : [];

            const updated = arr.map((e) => {
              const match = group.items.find((m) => m.invoice_id === e?.invoice_id);
              if (!match) return e;
              if (String(e?.payout_id || "") !== payoutRef.id || e?.status !== "requested") {
                return e;
              }
              return { ...e, status: "paid", paid_at: new Date().toISOString() };
            });

            tx.set(docRef, { commission_entries: updated }, { merge: true });
          }

          tx.set(
            payoutRef,
            {
              status: "paid",
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { merge: true }
          );
        });

        if (payout.referrer_email) {
          await emitEmail("referral_payout_paid", payout.referrer_email as string, {
            payout_id: payoutRef.id,
            transfer_id: transferId,
            amount_gbp: payout.amount_gbp || 0,
          });
        }

        await notifyAdmins("admin_referral_payout_paid", {
          payout_id: payoutRef.id,
          transfer_id: transferId,
          referrer_email: payout.referrer_email || "",
          amount_gbp: payout.amount_gbp || 0,
        });

        break;
      }

      case "transfer.reversed": {
        const transfer = event.data.object as Stripe.Transfer;
        const transferId = transfer.id;

        const paySnap = await firestore
          .collection("referral_payouts")
          .where("transfer_id", "==", transferId)
          .limit(1)
          .get();

        if (paySnap.empty) break;

        const payoutRef = paySnap.docs[0].ref;
        const payout = paySnap.docs[0].data() || {};
        const entries: Array<{ referral_doc_id: string; invoice_id: string; amount: number }> =
          Array.isArray(payout.entries) ? payout.entries : [];

        await firestore.runTransaction(async (tx) => {
          for (const group of groupBy(entries, (e) => e.referral_doc_id)) {
            const docRef = firestore.collection("referrals").doc(group.key);
            const snap = await tx.get(docRef);
            if (!snap.exists) continue;

            const d = snap.data() || {};
            const arr: any[] = Array.isArray(d.commission_entries) ? d.commission_entries : [];

            const updated = arr.map((e) => {
              const match = group.items.find((m) => m.invoice_id === e?.invoice_id);
              if (!match) return e;
              if (String(e?.payout_id || "") !== payoutRef.id) return e;

              if (e?.status === "requested" || e?.status === "paid") {
                const { payout_id: _a, requested_at: _b, transfer_id: _c, paid_at: _d, ...rest } =
                  e || {};
                return { ...rest, status: "unpaid", reversed_at: new Date().toISOString() };
              }

              return e;
            });

            tx.set(docRef, { commission_entries: updated }, { merge: true });
          }

          tx.set(
            payoutRef,
            {
              status: "reversed",
              updated_at: new Date().toISOString(),
            },
            { merge: true }
          );
        });

        if (payout.referrer_email) {
          await emitEmail("referral_payout_reversed", payout.referrer_email as string, {
            payout_id: payoutRef.id,
            transfer_id: transferId,
            amount_gbp: payout.amount_gbp || 0,
          });
        }

        await notifyAdmins("admin_referral_payout_reversed", {
          payout_id: payoutRef.id,
          transfer_id: transferId,
          referrer_email: payout.referrer_email || "",
          amount_gbp: payout.amount_gbp || 0,
        });

        break;
      }

      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;

        const purpose = String(s.metadata?.purpose || "");
        const bookingType = String(s.metadata?.booking_type || "");
        const bookingId = String(s.metadata?.booking_id || "").trim();

        const isClassBooking =
          bookingId &&
          (purpose === "class_booking" || bookingType === "class_prebook" || !purpose);

        if (isClassBooking) {
          const paid = s.payment_status === "paid";
          if (!paid) break;

          const bookingRef = firestore.collection("bookings").doc(bookingId);

          const paymentIntentId =
            typeof s.payment_intent === "string" ? s.payment_intent : null;

          let stripeChargeId: string | null = null;

          if (paymentIntentId) {
            try {
              const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
              stripeChargeId =
                typeof pi.latest_charge === "string" ? pi.latest_charge : null;
            } catch (e: any) {
              console.warn("[webhook] payment intent lookup failed:", e?.message || e);
            }
          }

          await bookingRef.set(
            {
              status: "confirmed",
              paid: true,
              paid_at: Timestamp.now(),
              stripe_checkout_session_id: s.id,
              stripe_payment_intent_id: paymentIntentId,
              stripe_charge_id: stripeChargeId,
              refund_status: "none",
              updated_at: Timestamp.now(),
            },
            { merge: true }
          );

          try {
            const bSnap = await bookingRef.get();
            const booking = bSnap.exists ? (bSnap.data() as any) : null;

            const sessionId = String(booking?.session_id || "").trim();
            let sessionData: any = null;

            if (sessionId) {
              const sessionSnap = await firestore.collection("session").doc(sessionId).get();
              if (sessionSnap.exists) {
                sessionData = sessionSnap.data() as any;
              }
            }

            const recipient = String(
              booking?.guest_email || booking?.user_email || ""
            )
              .trim()
              .toLowerCase();

            if (recipient) {
              await emitEmail("class_booking_confirmed", recipient, {
                booking_id: bookingId,
                session_id: sessionId,
                payment_method: "stripe",
                amount_gbp: Number(booking?.amount_gbp || 9),
                class_id: sessionData?.class_id || booking?.class_id || "",
                class_name: sessionData?.class_name || booking?.class_name || "",
                gym_name: sessionData?.gym_name || booking?.gym_name || "",
                start_time: sessionData?.start_time || booking?.session_start_at || null,
                note: "Paid £9 via Stripe",
              });
            }
          } catch (e: any) {
            console.warn("[webhook] class booking email failed:", e?.message || e);
          }
        }

        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const bookingSnap = await findBookingByChargeOrPaymentIntent(charge);

        if (!bookingSnap) break;

        const amountRefundedGbp = Number(((charge.amount_refunded || 0) / 100).toFixed(2));

        await bookingSnap.ref.set(
          {
            stripe_charge_id: charge.id,
            refund_status: charge.refunded ? "succeeded" : "pending",
            amount_refunded_gbp: amountRefundedGbp,
            updated_at: Timestamp.now(),
          },
          { merge: true }
        );

        break;
      }

      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (e: any) {
    console.error("[webhook] processing error:", e);
    return res.status(500).send(`Webhook handler failed: ${e?.message || "Unknown error"}`);
  }
}
