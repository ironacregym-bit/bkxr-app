
// pages/api/admin/notifications/friday-checkin-reminder.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
const CRON_KEY = process.env.CRON_KEY;
const BASE = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
function startOfIsoWeek(d=new Date()){const dt=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));const day=dt.getUTCDay()||7;dt.setUTCDate(dt.getUTCDate()-(day-1));return dt;}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["GET","POST"].includes(req.method || "")) { res.setHeader("Allow","GET, POST"); return res.status(405).json({ error: "Method not allowed" }); }
  if (CRON_KEY && req.headers["x-cron-key"] !== CRON_KEY) return res.status(403).json({ error: "Forbidden" });

  const usersSnap = await firestore.collection("users").select().get();
  const weekStart = startOfIsoWeek(); const weekStartMs = weekStart.getTime();
  let targeted=0, emitted=0;

  for (const d of usersSnap.docs) {
    const email = d.id; if (!email) continue;
    const u = d.data() || {};
    const status = String(u.subscription_status || "none");
    const isGym = u.membership_status === "gym_member" && !!u.membership_verified;
    if (status !== "active" && !isGym) continue; // nudge subscribers/gym; change if you want everyone

    const last = Date.parse(String(u.last_checkin_at || ""));
    const checkedThisWeek = !isNaN(last) && last >= weekStartMs;
    if (checkedThisWeek) continue;

    targeted++;
    await fetch(`${BASE}/api/notify/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "friday_checkin_reminder", email, context: { week_start_iso: weekStart.toISOString() }, force: false }),
    }).catch(() => null);
    emitted++;
  }
  return res.status(200).json({ ok: true, targeted, emitted });
}
