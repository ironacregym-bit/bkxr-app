
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  const role = (session?.user as any)?.role || "user";
  if (!session?.user?.email || (role !== "admin" && role !== "gym")) return res.status(401).json({ error: "Unauthorized" });

  try {
    const b = req.body || {};
    const key = String(b.key || "").trim();
    if (!key) return res.status(400).json({ error: "Missing key" });

    const doc = {
      key,
      enabled: !!b.enabled,
      event: String(b.event || "onboarding_incomplete"),
      priority: Number(b.priority || 0),
      channels: Array.isArray(b.channels) ? b.channels : ["in_app"],
      throttle_seconds: Number(b.throttle_seconds || 0),
      condition: b.condition || {},
      title_template: String(b.title_template || ""),
      body_template: String(b.body_template || ""),
      url_template: String(b.url_template || "/"),
      data_template: b.data_template || {},
      updated_at: Timestamp.now(),
      updated_by: session.user.email,
    };
    const ref = firestore.collection("notification_rules").doc(key);
    const snap = await ref.get();
    const payload = { ...doc, ...(snap.exists ? {} : { created_at: Timestamp.now() }) };
    await ref.set(payload, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[rules/save]", e?.message || e);
    return res.status(500).json({ error: "Failed to save rule" });
  }
}
