
// pages/api/billing/webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "../../../lib/stripe";
import firestore from "../../../lib/firestoreClient";

// Disable Next.js body parser to access the raw body for Stripe signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

function buffer(readable: any) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: any[] = [];
    readable.on("data", (chunk: any) => chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
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
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        // Fetch customer to get the email
        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as any)?.email as string | undefined;
        if (!email) break;

        const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
        const status = subscription.status; // trialing | active | past_due | canceled | incomplete | paused (via end_behavior)

        await firestore.collection("users").doc(email).set(
          {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            subscription_status: status,
            trial_end: trialEnd,
            is_premium: status === "trialing" || status === "active",
            last_billing_event_at: new Date().toISOString(),
            billing_plan: "online_monthly",
          },
          { merge: true }
        );
        break;
      }

      case "customer.subscription.trial_will_end": {
        const subs = event.data.object as Stripe.Subscription;
        const customerId = subs.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as any)?.email as string | undefined;
        if (!email) break;

        // You might trigger email/push here (“Your trial ends on …”)
        await firestore.collection("users").doc(email).set(
          {
            last_billing_event_at: new Date().toISOString(),
          },
          { merge: true }
        );
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as any)?.email as string | undefined;
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

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as any)?.email as string | undefined;
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

      case "customer.subscription.deleted": {
        const subs = event.data.object as Stripe.Subscription;
        const customerId = subs.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        const email = (customer as any)?.email as string | undefined;
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

      default: {
        // Ignore other event types
      }
    }

    return res.status(200).json({ received: true });
  } catch (e: any) {
    console.error    console.error("[webhook] processing error:", e);
    return res.status(500).send(`Webhook handler failed: ${e?.message || "Unknown error"}`);
  }
}
