
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { hasRole, isGymOwner } from "../../../lib/rbac";
import { generateToken } from "../../../lib/token";
import { toMillis } from "../../../lib/time";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Not signed in" });

  if (!hasRole(session, ["gym", "admin"])) return res.status(403).json({ error: "Forbidden" });

  const { session_id, expires_in_minutes = 30 } = req.body as {
    session_id?: string;
    expires_in_minutes?: number;
  };
  if (!session_id) return res.status(400).json({ error: "session_id is required" });

  try {
    const sessRef = firestore.collection("session").doc(session_id);
    const sessSnap = await sessRef.get();
    if (!sessSnap.exists) return res.status(404).json({ error: "Session not found" });

    const sessData = sessSnap.data() as any;
    const gymId = String(sessData?.gym_id || "");
    const user = session.user as any;
    const userRole = user?.role;

    if (!isGymOwner(session, gymId) && userRole !== "admin") {
      return res.status(403).json({ error: "Not owner of this gym" });
    }

    const token = generateToken();
    const expiresMs = Math.max(1, Math.min(1440, Number(expires_in_minutes))) * 60 * 1000;
    const expires_at = Date.now() + expiresMs;

    await firestore.collection("bookingTokens").doc(token).set({
      token,
      session_id,
      gym_id: gymId,
      created_by: user?.email || null,
      created_at: new Date(),
      expires_at, // numeric ms since epoch
      used: false,
      max_use: 1,
    });

    const safeBase =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const link = `${safeBase}/book/${encodeURIComponent(token)}`;

    // ✅ Normalise start_time to milliseconds before formatting
    const startMs = toMillis(sessData?.start_time);
    const whenStr = startMs ? new Date(startMs).toLocaleString() : "soon";

    const whatsappMessage = `Join our BXKR session at ${sessData?.gym_name || "the gym"} on ${whenStr}! Click to book: ${link}`;

    return res.status(200).json({ ok: true, token, link, expires_at, whatsappMessage });
  } catch (err: any) {
    console.error("Generate link error:", err?.message || err);
    return res.status(500).json({ error: "Failed to generate link" });
  }
}
