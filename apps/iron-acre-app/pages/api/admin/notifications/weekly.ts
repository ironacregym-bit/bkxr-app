
// pages/api/admin/notifications/weekly.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { notifyWeeklyNudge } from "../../../../lib/notify";

const CRON_KEY = process.env.CRON_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (CRON_KEY && req.headers["x-cron-key"] !== CRON_KEY) return res.status(403).json({ error: "Forbidden" });
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const mode = String(req.query.mode || "all"); // trial_ended|past_due|paused|active|trialing|all
  const users = await firestore.collection("users").get();
  let sent = 0;

  await Promise.all(users.docs.map(async (doc) => {
    const email = doc.id;
    const u = doc.data() || {};
    if (!email) return;

    // Skip verified gym members
    if (u.membership_status === "gym_member" && u.membership_verified) return;

    const status = (u.subscription_status || "none") as string;
    if (mode !== "all" && status !== mode) return;

    if (status === "active" || status === "trialing") {
      await notifyWeeklyNudge(email, "active");
      sent++;
    } else {
      await notifyWeeklyNudge(email, "locked");
      sent++;
    }
  }));

  return res.status(200).json({ ok: true, sent });
}
