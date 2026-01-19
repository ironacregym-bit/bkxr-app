
// pages/api/admin/notifications/monday-kickoff.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";

const CRON_KEY = process.env.CRON_KEY;
const BASE = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["GET", "POST"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (CRON_KEY && req.headers["x-cron-key"] !== CRON_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const usersSnap = await firestore.collection("users").select().get();
    let success = 0, failed = 0;

    // emit per user
    for (const doc of usersSnap.docs) {
      const email = doc.id;
      if (!email) continue;
      try {
        await fetch(`${BASE}/api/notify/emit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "monday_kickoff",
            email,
            context: { week_start_iso: new Date().toISOString().slice(0, 10) },
            force: false
          }),
        });
        success++;
      } catch {
        failed++;
      }
    }

    return res.status(200).json({ ok: true, users: usersSnap.size, success, failed });
  } catch (e: any) {
    console.error("[monday-kickoff]", e?.message || e);
    return res.status(500).json({ error: "Cron failed" });
  }
}
