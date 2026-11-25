
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

/**
 * POST /api/membership/verify-code
 * Body: { code: string }
 * - Compares provided code with IRON_ACRE_MEMBER_CODE
 * - If valid + user authenticated, marks user as gym member (merge-only)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) {
    return res.status(401).json({ error: "Please sign in first." });
  }

  const { code } = (req.body || {}) as { code?: string };
  const expected = (process.env.IRON_ACRE_MEMBER_CODE || "").trim();

  if (!code || !expected || code.trim() !== expected) {
    return res.status(400).json({ error: "Invalid code." });
  }

  try {
    const docRef = firestore.collection("users").doc(email);
    const payload: Record<string, unknown> = {
      membership_status: "gym_member",
      membership_source: "iron_acre",
      membership_verified: true,
      membership_verified_at: new Date().toISOString(),
    };
    await docRef.set(payload, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[membership/verify-code] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to apply membership. Please try again." });
  }
}
