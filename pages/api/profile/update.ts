
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
    const usersRef = firestore.collection("Users").doc(userEmail);
    const snap = await usersRef.get();
    const nowIso = new Date().toISOString();

    const coerce = (v: any) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      if (typeof v === "string") return v;
      if (typeof v === "boolean") return v;
      return v; // allow objects (equipment/preferences) to be stored as-is
    };

    const updates: Record<string, any> = {};
    Object.entries(fields).forEach(([k, v]) => {
      const val = coerce(v);
      if (val !== undefined) updates[k] = val;
    });

    updates.last_login_at = nowIso;
    if (!snap.exists)    if (!snap.exists) updates.created_at = nowIso;

    await usersRef.set(updates, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[profile/update] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
}
