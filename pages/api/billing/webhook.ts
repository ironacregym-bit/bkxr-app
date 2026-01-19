
// pages/api/billing/webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "../../../lib/stripe";
import type Stripe from "stripe";
import firestore from "../../../lib/firestoreClient";

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
  // Only "active" is fully unlocked; "trialing" is unlocked until trial_end (UI checks date)
  return status === "active" || status === "trialing";
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
      /**
       * Keep your app's subscription fields mirrored to Stripe on create/update.
       * - status: trialing | active | past_due | canceled | incomplete | paused | ...
       * - trial_end: mirror for UI banner (days left)
       * - is_premium: true for active/trialing (client confirms trial not expired)
       */
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
        break;
      }

      /**
       * Payment success → unlock immediately (active)
       */
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
        break;
      }

      /**
       * Payment failed → lock
       */
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
        break;
      }

      /**
       * Subscription canceled/deleted → lock
       */
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
        break;
      }

      /**
       * Optional: handle checkout.session.completed as a safety net (some flows)
       * We do not change status here; status will flow from invoice/subscription events.
       */
      case "checkout.session.completed": {
        // no-op; rely on invoice/sub events for accurate status
        break;
      }

      default:
        // Ignore other event types
        break;
    }

    return res.status(200).json({ received: true });
  } catch (e: any) {
    console.error("[webhook] processing error:", e);
    return res.status(500).send(`Webhook handler failed: ${e?.message || "Unknown error"}`);
  }
}
