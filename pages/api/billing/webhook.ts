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

// ---- RAW BUFFER HELPER (required for Stripe signature verification) ----
function buffer(readable: any): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: any[] = [];
    readable.on("data", (chunk: any) => chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}

// ---- UTILITIES ----
function origin() {
  return process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
}
async function emitEmail(event: string, email: string, context: Record<string, any> = {}, force = false) {
  const BASE = origin();
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
  // Keep your existing CTA emitter; complements explicit emails below
  const BASE = origin();
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

// NEW: Idempotency guard so Stripe retries don’t double-process
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

// ---- WEBHOOK HANDLER ----
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
    // Idempotency guard
    try {
      if (await alreadyProcessed(event.id)) {
        return res.status(200).json({ received: true, duplicate: true });
      }
    } catch (e) {
      console.warn("[webhook] idempotency guard issue:", (e as any)?.message);
    }

    switch (event.type) {
      /* =========================
       *  SUBSCRIPTIONS & INVOICES
       * ========================= */
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

        // If not premium (post-trial), mark membership_status = expired and email the user
        if (!premium && hasTrialExpired(trialEndIso)) {
          baseUpdate.membership_status = "expired";
        }

        await firestore.collection("users").doc(email).set(baseUpdate, { merge: true });

        if (!premium) {
          // Gentle CTA (existing)
          await emitUpgradeCta(email);
          // Explicit email about expiry (optional; disable if too chatty)
          if (hasTrialExpired(trialEndIso)) {
            await emitEmail("trial_expired", email, {
              trial_end: trialEndIso,
            });
          }
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
            membership_status: FieldValue.delete(), // clear expired if set before
            last_billing_event_at: new Date().toISOString(),
          },
          { merge: true }
        );

        // Commission accrual (unchanged)
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

        // If user had a trial_end and it's past, mark expired and email
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

      /* =========================
       *  REFERRAL PAYOUTS via CONNECT
       * ========================= */
      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer; // platform -> connected account
        const transferId = transfer.id;

        const paySnap = await firestore
          .collection("referral_payouts")
          .where("transfer_id", "==", transferId)
          .limit(1)
          .get();
        if (paySnap.empty) break;

        const payoutRef = paySnap.docs[0].ref;
        const payout = paySnap.docs[0].data() || {};
        if (payout.status === "paid") break; // idempotent

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
              if (String(e?.payout_id || "") !== payoutRef.id || e?.status !== "requested") return e;
              return { ...e, status: "paid", paid_at: new Date().toISOString() };
            });

            tx.set(docRef, { commission_entries: updated }, { merge: true });
          }

          tx.set(
            payoutRef,
            { status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            { merge: true }
          );
        });

        // Email referrer and admins
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

      // NOTE: Stripe does not emit "transfer.failed".
      // Reversal is the supported transfer rollback path:
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
                const { payout_id: _a, requested_at: _b, transfer_id: _c, paid_at: _d, ...rest } = e || {};
                return { ...rest, status: "unpaid", reversed_at: new Date().toISOString() };
              }
              return e;
            });

            tx.set(docRef, { commission_entries: updated }, { merge: true });
          }

          tx.set(
            payoutRef,
            { status: "reversed", updated_at: new Date().toISOString() },
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
        // Optional analytics; nothing required
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
