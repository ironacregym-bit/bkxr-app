
// pages/api/notify/templates/save.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }

  const session = await getServerSession(req, res, authOptions);
  const role = (session?.user as any)?.role || "user";
  if (!session?.user?.email || (role !== "admin" && role !== "gym")) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { key, enabled, title_template, body_template, url_template, data_template, channels, throttle_seconds, test_defaults } = req.body || {};
    if (!key || !title_template || !body_template) return res.status(400).json({ error: "key, title_template, body_template are required" });

    const docRef = firestore.collection("notification_templates").doc(String(key));
    const now = Timestamp.now();
    const payload = {
      key: String(key),
      enabled: Boolean(enabled),
      title_template: String(title_template),
      body_template: String(body_template),
      url_template: url_template ? String(url_template) : null,
      data_template: data_template &&      data_template: data_template && typeof data_template === "object" ? data_template : null,
      channels: Array.isArray(channels) && channels.length ? channels : ["push"],
      throttle_seconds: throttle_seconds != null ? Number(throttle_seconds) : 0,
      test_defaults: test_defaults && typeof test_defaults === "object" ? test_defaults : null,
      updated_at: now,
    };
    const snap = await docRef.get();
    if (!snap.exists) (payload as any).created_at = now;

    await docRef.set(payload, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[templates/save]", e?.message || e);
    return res.status(500).json({ error: "Failed to save template" });
  }
}
