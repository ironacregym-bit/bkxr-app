
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const base = process.env.APP_BASE_URL;
    const secret = process.env.CRON_SECRET;
    if (!base || !secret) return res.status(500).json({ error: "Missing APP_BASE_URL or CRON_SECRET" });

    const r = await fetch(`${base}/api/integrations/hdidido/runner`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${secret}` }
    });

    const text = await r.text();
    res.status(r.status).send(text);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Proxy error" });
  }
}
