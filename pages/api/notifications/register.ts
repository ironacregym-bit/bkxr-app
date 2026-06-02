// pages/api/notifications/register.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

type PushSubscriptionLike = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  [key: string]: any;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = String(session?.user?.email || "").trim().toLowerCase();

  if (!email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { subscription } = req.body || {};
    const sub = (subscription || {}) as PushSubscriptionLike;

    if (!sub || typeof sub !== "object" || !sub.endpoint) {
      return res.status(400).json({ error: "Valid subscription object required" });
    }

    if (
      !sub.keys ||
      typeof sub.keys !== "object" ||
      !sub.keys.p256dh ||
      !sub.keys.auth
    ) {
      return res.status(400).json({ error: "Valid subscription keys are required" });
    }

    const now = Timestamp.now();

    const cleanedSub = {
      endpoint: String(sub.endpoint),
      expirationTime:
        typeof sub.expirationTime === "number" || sub.expirationTime === null
          ? sub.expirationTime ?? null
          : null,
      keys: {
        p256dh: String(sub.keys.p256dh),
        auth: String(sub.keys.auth),
      },
      last_seen: now,
    };

    const docRef = firestore.collection("web_push_subscriptions").doc(email);
    const snap = await docRef.get();
    const current =
      snap.exists && Array.isArray(snap.data()?.subs) ? (snap.data()!.subs as any[]) : [];

    // Remove any exact endpoint duplicates from the old list first
    const dedupedOld = current.filter((s: any) => String(s?.endpoint || "") !== cleanedSub.endpoint);

    // Enforce exactly ONE active subscription per user/email.
    // We keep the newest/current device subscription only.
    const finalSubs = [cleanedSub];

    await docRef.set(
      {
        email,
        subs: finalSubs,
        updated_at: now,
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      email,
      replaced_count: dedupedOld.length,
      stored: finalSubs.length,
    });
  } catch (e: any) {
    console.error("[notifications/register] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to register subscription" });
  }
}
