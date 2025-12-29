
// pages/api/notifications/test-send.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { sendToUser } from "../../../lib/sendWebPush";

/**
 * Send a test push:
 * - GET /api/notifications/test-send?title=...&body=...&url=/...&email=...
 * - POST { title, body, url, data, email? }
 * If `email` is omitted, we use the authenticated user's email.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  const source = req.method === "GET" ? req.query : (req.body || {});
  const targetEmail =
    typeof source.email === "string" && source.email.trim()
      ? source.email.trim()
      : session?.user?.email || "";

  if (!targetEmail) {
    res.setHeader("Allow", "GET, POST");
    return res.status(401).json({ error: "Unauthorized (no session or email provided)" });
  }

  const title = (source.title as string) || "BXKR Test";
  const body = (source.body as string) || "It works!";
  const url = (source.url as string) || "/";
  const data = typeof source.data === "object" ? (source.data as Record<string, string>) : undefined;

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET,    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const resp = await sendToUser(targetEmail, { title, body, url, data });
    return res.status(200).json(resp);
  } catch (e: any) {
    console.error("[notifications/test-send] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to send push" });
  }
}
