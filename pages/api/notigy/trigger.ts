
// pages/api/notify/trigger.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { sendScenario } from "../../../lib/messenger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { email, key, context, force } = req.body || {};
    if (!key) return res.status(400).json({ error: "key required" });
    const recipient = String(email || session.user.email);
    const resp = await sendScenario({ email: recipient, key: String(key), context: context || {}, force: !!force });
    return res    return res.status(200).json(resp);
  } catch (e: any) {
    console.error("[notify/trigger]", e?.message || e);
    return res.status(500).json({ error: "Failed to trigger notification" });
  }
}
