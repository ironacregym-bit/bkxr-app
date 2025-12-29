
// pages/api/notify/event.ts  (optional mapping)
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";
import { sendScenario } from "../../../lib/messenger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { event_type, email, context } = req.body || {};
    if (!event_type) return res.status(400).json({ error: "event_type required" });
    const recipient = String(email || session.user.email);

    const snap = await firestore.collection("notification_rules")
      .where("enabled", "==", true)
      .where("event_type", "==", String(event_type))
      .get();

    if (snap.empty) return res.status(200).json({ ok: true, sent: 0, failed: 0, rules: 0 });

    let sent = 0, failed = 0;
    for (const d of snap.docs) {
      const r = d.data() as any;
      const resp = await sendScenario({
        email: recipient,
        key: r.template_key,
        context: context || {},
        force: false,
      });
      sent += resp.sent;
      failed += resp.failed;
    }
    return res.status(200).json({ ok: true, sent, failed, rules: snap.size });
  } catch (e: any) {
    console.error("[notify/event]", e?.message || e);
    return res.status(500).json({ error: "Failed to process event" });
  }
}
