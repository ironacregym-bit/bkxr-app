
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";

/**
 * Cron endpoint to emit "monday_kickoff" to all users.
 * Schedule this with Vercel Cron for Mondays.
 *
 * It calls your existing /api/notify/emit for each user so:
 *  - Rules are applied (message templates, channels)
 *  - In-app feed items are created
 *  - Push is sent if user opted in
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Optional: Restrict to Vercel cron (you can add a secret if needed)
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // Minimal user scan. You can narrow by active flag if you have one.
    const usersSnap = await firestore.collection("users").select().get();
    const users = usersSnap.docs.map((d) => d.id);

    let success = 0;
    let failed = 0;

    // We use the same host for the API call. On Vercel, absolute URL is safer.
    const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "";

    // Emit in small batches to avoid overwhelming function runtime (simple sequential here)
    for (const email of users) {
      try {
        await fetch(`${base}/api/notify/emit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // We pass email to target each user explicitly
          body: JSON.stringify({
            event: "monday_kickoff",
            email,
            context: {
              week_start_iso: new Date().toISOString().slice(0, 10),
            },
            force: false, // rules can add throttle if you ever want it
          }),
        });
        success++;
      } catch (e) {
        failed++;
      }
    }

    return res.status(200).json({ ok: true, users: users.length, success, failed });
  } catch (e: any) {
    console.error("[cron/monday-kickoff]", e?.message || e);
    return res.status(500).json({ error: "Cron failed" });
  }
}
