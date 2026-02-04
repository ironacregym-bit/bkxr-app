// pages/api/billing/webhook.ts (additions shown inline)

import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "../../../lib/stripe";
import type Stripe from "stripe";
import firestore from "../../../lib/firestoreClient";
import { FieldValue } from "@google-cloud/firestore";

export const config = { api: { bodyParser: false } };

// ... buffer(), getCustomerEmail(), trialEndIsoFrom(), isPremiumFromStatus(), emitUpgradeCta(), currentMonth(), computeCommissionRate() (unchanged)

// NEW: Idempotency guard
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("Missing stripe-signature header");

  let event: Stripe.Event;

  try {
    const buf = await Buffer(req);
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e: any) {
    console.error("[webhook] signature verification failed:", e?.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  // Idempotency: skip if processed
  try {
    if (await alreadyProcessed(event.id)) {
      return res.status(200).json({ received: true, duplicate: true });
    }
  } catch (e) {
    // Soft fail idempotency, continue
    console.warn("[webhook] idempotency guard issue:", (e as any)?.message);
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const email = await getCustomerEmail(customerId);
        if (!email) break;

        const status = sub.status as string; // active|trialing|past_due|paused|canceled|incomplete...
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

        // If not premium (post-trial), mark membership_status = expired
        if (!premium && hasTrialExpired(trialEndIso)) {
          baseUpdate.membership_status = "expired";
        }

        await firestore.collection("users").doc(email).set(baseUpdate, { merge: true });

        if (!premium) {
          await emitUpgradeCta(email);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const email = await getCustomerEmail(customerId);
        const subscriptionId = (invoice.subscription as string) || undefined;
        if (!email) break;

        // Payment success => premium
        await firestore.collection("users").doc(email).set(
          {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: "active",
            is_premium: true,
            membership_status: FieldValue.delete(), // clear expired if previously set
            last_billing_event_at: new Date().toISOString(),
          },
          { merge: true }
        );

        // Referral commissions (as you have) ...
        // (unchanged – keeping your existing commission logic, including duplicate invoice guards)
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

          const existingEntries: Array<any> = Array.isArray(ref.commission_entries) ? ref.commission_entries : [];
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
        const subscriptionId = (invoice.subscription as string) || undefined;
        if (!email) break;

        const update: Record<string, any> = {
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: "past_due",
          is_premium: false,
          last_billing_event_at: new Date().toISOString(),
        };

        // If user had a trial_end and it's past, mark expired
        const userSnap = await firestore.collection("users").doc(email).get();
        const trialEnd = (userSnap.data()?.trial_end as string) || null;
        if (hasTrialExpired(trialEnd)) {
          update.membership_status = "expired";
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
        break;
      }

      case "checkout.session.completed": {
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
