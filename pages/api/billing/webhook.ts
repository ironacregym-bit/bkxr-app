
// pages/api/billing/webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "../../../lib/stripe";
import type Stripe from "stripe";
import firestore from "../../../lib/firestoreClient";
import { FieldValue } from "@google-cloud/firestore";

// Disable Next.js body parser to access the raw body for Stripe signature verification
export const config = {
  api: { bodyParser: false },
};

function buffer(readable: any) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: any[] = [];
    readable.on("data", (chunk: any) => chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
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
  const BASE = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!BASE) return;
  await fetch(`${BASE}/api/notify/emit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "upgrade_cta", email, context: { reason: "subscription_status" }, force: false }),
  }).catch(() => null);
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function computeCommissionRate(activeCount: number): number {
  if (activeCount >= 50) return 0.30;
  if (activeCount >= 40) return 0.25;
  if (activeCount >= 30) return 0.20;
  if (activeCount >= 20) return 0.15;
  if (activeCount >= 10) return 0.10;
  return 0.05;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("Missing stripe-signature header");

  let event: Stripe.Event;

  try {
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e: any) {
    console.error("[webhook] signature verification failed:", e?.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const email = await getCustomerEmail(customerId);
        if (!email) break;

        const status = sub.status as string;
        const trialEndIso = trialEndIsoFrom(sub);

        await firestore.collection("users").doc(email).set(
          {
            stripe_customer_id: customerId,
            stripe_subscription_id: sub.id,
            subscription_status: status,
            trial_end: trialEndIso,
            is_premium: isPremiumFromStatus(status),
            last_billing_event_at: new Date().toISOString(),
            billing_plan: "online_monthly",
          },
          { merge: true }
        );

        if (!isPremiumFromStatus(status)) {
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

        await firestore.collection("users").doc(email).set(
          {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: "active",
            is_premium: true,
            last_billing_event_at: new Date().toISOString(),
          },
          { merge: true }
        );

        // Referral commission processing (Option B — only after payment)
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

          // Avoid duplicate entries for the same invoice
          const existingEntries: Array<any> = Array.isArray(ref.commission_entries) ? ref.commission_entries : [];
          const duplicate = existingEntries.some((e) => e?.invoice_id === invoice.id);
          if (duplicate) break;

          // 1) Mark referral as active/paid
          await refDoc.ref.set(
            {
              converted_to_paid: true,
              subscription_status: "active",
            },
            { merge: true }
          );

          // 2) Count active paid referrals for referrer
          const activePaidSnap = await firestore
            .collection("referrals")
            .where("referrer_email", "==", referrerEmail)
            .where("converted_to_paid", "==", true)
            .get();

          const activePaidCount = activePaidSnap.size;
          const rate = computeCommissionRate(activePaidCount);
          const commission = Number((invoiceAmount * rate).toFixed(2));

          // 3) Update referral doc with commission entry
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

          // 4) Update referrer aggregates
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

        await firestore.collection("users").doc(email).set(
          {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: "past_due",
            is_premium: false,
            last_billing_event_at: new Date().toISOString(),
          },
          { merge: true }
        );

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
