
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { hasRole, isGymOwner } from "../../../lib/rbac";
import { generateToken, minutesFromNow } from "../../../lib/token";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Not signed in" });
  if (!hasRole(session, ["gym", "admin"])) return res.status(403).json({ error: "Forbidden" });

  const { session_id, expires_in_minutes = 30 } = req.body as { session_id?: string; expires_in_minutes?: number };
  if (!session_id) return res.status(400).json({ error: "session_id is required" });

  try {
    const sessRef = firestore.collection("session").doc(session_id);
    const sessSnap = await sessRef.get();
    if (!sessSnap.exists) return res.status(404).json({ error: "Session not found" });
    const sessData = sessSnap.data() as any;
    const gymId = String(sessData?.gym_id || "");

    if (!isGymOwner(session, gymId) && session.user.role !== "admin") {
      return res.status(403).json({ error: "Not owner of this gym" });
    }

    const token = generateToken();
    const expires_at = minutesFromNow(Math.max(1, Math.min(1440, Number(expires_in_minutes))));

    await firestore.collection("bookingTokens").doc(token).set({
      token,
      session_id,
      gym_id: gymId,
      created_by: session.user.email || session.user.id,
      created_at: new Date(),
      expires_at,
      used: false,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const link = `${baseUrl}/api/book/${token}`;
    return res.status(200).json({ ok: true, token, link, expires_at });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to generate link" });
  }
}
