
// pages/api/notifications/register.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try{
    const { subscription } = req.body || {};
    if (!subscription || typeof subscription !== "object" || !subscription.endpoint) {
      return res.status(400).json({ error: "Valid subscription object required" });
    }

    const docRef = firestore.collection("web_push_subscriptions").doc(email);
    const snap = await docRef.get();
    const now = Timestamp.now();
    const current = snap.exists && Array.isArray(snap.data()?.subs) ? snap.data()!.subs : [];

    // Deduplicate by endpoint
    const filtered = current.filter((s: any) => s?.endpoint !== subscription.endpoint);
    filtered.push({ ...subscription, last_seen: now });

    await docRef.set({ email, subs: filtered, updated_at: now }, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[notifications/register] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to register subscription" });
  }
}
