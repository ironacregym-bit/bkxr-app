
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { sendMail } from "../../../../lib/email";

const TRIAL_DAYS = Number(process.env.BXKR_TRIAL_DAYS || 14);
const GRACE_HOURS = Number(process.env.BXKR_GRACE_HOURS || 0); // 0 = no grace
const CRON_KEY = process.env.CRON_KEY; // set this in Vercel env

function toDate(v: any): Date | null {
  if (!v) return null;
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (v?.toDate) { try { return v.toDate() as Date; } catch { return null; } }
  if (typeof v?.seconds === "number") { return new Date(v.seconds * 1000); }
  return null;
}
function fmt(d: Date) { return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (CRON_KEY && req.headers["x-cron-key"] !== CRON_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const now = new Date();
  const tMinus3 = new Date(now.getTime() + 3 * 86400000);
  const tMinus1 = new Date(now.getTime() + 1 * 86400000);

  const usersSnap = await firestore.collection("users").get();
  let notifiedT3 = 0, notifiedT1 = 0, ended = 0;

  await Promise.all(usersSnap.docs.map(async (doc) => {
    const u = doc.data() || {};
    const email = doc.id;
    if (!email) return;

    // Gym verified members keep access; skip them
    if (u.membership_status === "gym_member" && u.membership_verified) return;

    const status = u.subscription_status || "none";
    const trialEnd = toDate(u.trial_end);

    // T-3 email
    if (status === "trialing" && trialEnd && trialEnd.toDateString() === tMinus3.toDateString()) {
      await sendMail({
        to: email,
        subject: "Your BXKR trial ends in 3 days",
        html: `<p>Your BXKR trial ends on <strong>${fmt(trialEnd)}</strong>. Keep Premium by subscribing now.</p>
               <p><a href="${process.env.NEXTAUTH_URL}/paywall" target="_blank">Subscribe to continue</a></p>`,
      });
      await doc.ref.set({ trial_last_notified: now.toISOString() }, { merge: true });
      notifiedT3++;
    }

    // T-1 email
    if (status === "trialing" && trialEnd && trialEnd.toDateString() === tMinus1.toDateString()) {
      await sendMail({
        to: email,
        subject: "Last day of your BXKR trial",
        html: `<p>Your trial ends on <strong>${fmt(trialEnd)}</strong>. Subscribe to keep Premium features.</p>
               <p><a href="${process.env.NEXTAUTH_URL}/paywall" target="_blank">Subscribe now</a></p>`,
      });
      await doc.ref.set({ trial_last_notified: now.toISOString() }, { merge: true });
      notifiedT1++;
    }

    // End trial if expired and not active
    const isActive = status === "active";
    const inTrial = status === "trialing" && trialEnd && now < trialEnd;

    if (!isActive && !inTrial && trialEnd && now >= trialEnd && status !== "trial_ended") {
      const graceUntil = GRACE_HOURS > 0 ? new Date(now.getTime() + GRACE_HOURS * 3600000).toISOString() : null;

      await doc.ref.set(
        {
          subscription_status: "trial_ended",
          is_premium: false,
          grace_until: graceUntil,
          last_billing_event_at: now.toISOString(),
        },
        { merge: true }
      );

      await sendMail({
        to: email,
        subject: "Your BXKR trial has ended",
        html: `<p>Your trial has ended. To continue with Premium features, please subscribe.</p>
               <p><a href="${process.env.NEXTAUTH_URL}/paywall" target="_blank">Subscribe to continue</a></p>`,
      });

      ended++;
    }
  }));

  return res.status(200).json({ ok: true, notifiedT3, notifiedT1, ended, when: now.toISOString() });
}
