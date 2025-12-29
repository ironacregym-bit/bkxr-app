
// pages/api/notifications/test-send.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { sendToUser } from "../../../lib/sendWebPush";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { title, body, url, data } = req.body || {};
    const resp = await sendToUser(email, {
      title: title || "BXKR Test",
      body: body || "It works!",
      url: url || "/",
      data: data || { type: "test" },
    });
    return res.status(200).json(resp);
  } catch (e: any) {
    console.error("[notifications/test-send] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to send" });
  }
}
