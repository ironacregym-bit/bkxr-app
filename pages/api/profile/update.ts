
// pages/api/profile/update.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  const { email, ...fields } = req.body || {};
  const userEmail = String(email || session.user.email);

  try {
    const usersRef = firestore.collection("users").doc(userEmail);
    const snap = await usersRef.get();
    const nowIso = new Date().toISOString();

    const updates: Record<string, any> = {};

    Object.entries(fields).forEach(([k, v]) => {
           // map alias on write
      const targetKey = k === "calorie_target" ? "caloric_target" : k;
      updates[targetKey] = v === undefined ? undefined : v;
    });

    updates.last_login_at = nowIso;
    if (!snap.exists) updates.created_at = nowIso;

    // Remove any undefined keys (so we don't write them)
    Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

    await usersRef.set(updates, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[profile/update] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
}
