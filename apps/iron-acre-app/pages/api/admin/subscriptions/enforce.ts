
// pages/api/admin/subscriptions/enforce.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { notifyTrialT1, notifyTrialT3, notifyTrialEnded } from "../../../../lib/notify";

const CRON_KEY = process.env.CRON_KEY;
const GRACE_HOURS = Number(process.env.BXKR_GRACE_HOURS || 0);

function toDate(v: any): Date | null {
  if (!v) return null;
  if (typeof v === "string") { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  if (v?.toDate) { try { return v.toDate() as Date; } catch { return null; } }
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  return null;
}
function sameUTCDate(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (CRON_KEY && req.headers["x-cron-key"] !== CRON_KEY) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const now = new Date();
  const d3 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 3));
  const d1 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

  const users = await firestore.collection("users").get();
  let notifiedT3 = 0, notifiedT1 = 0, ended = 0;

  await Promise.all(users.docs.map(async (doc) => {
    const u = doc.data() || {};
    const email = doc.id;
    if (!email) return;

    // Skip verified gym members
    if (u.membership_status === "gym_member" && u.membership_verified) return;

    const status = u.subscription_status || "none";
    const trialEnd = toDate(u.trial_end);

    // T-3
    if (status === "trialing" && trialEnd && sameUTCDate(trialEnd, d3)) {
      await notifyTrialT3(email, trialEnd.toISOString());
      notifiedT3++;
    }

    // T-1
    if (status === "trialing" && trialEnd && sameUTCDate(trialEnd, d1)) {
      await notifyTrialT1(email, trialEnd.toISOString());
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

      await notifyTrialEnded(email);
      ended++;
    }
  }));

  return res.status(200).json({ ok: true, notifiedT3, notifiedT1, ended, when: now.toISOString() });
}
