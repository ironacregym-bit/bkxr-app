
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]"; // ✅ correct relative path
import { hasRole, isGymOwner } from "../../../lib/rbac";
import { generateToken, minutesFromNow } from "../../../lib/token";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Not signed in" });
  }

  // Only gym owners (for their gym) or admins can generate guest links
  if (!hasRole(session, ["gym", "admin"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { session_id, expires_in_minutes = 30 } = req.body as {
    session_id?: string;
    expires_in_minutes?: number;
  };
  if (!session_id) {
    return res.status(400).json({ error: "session_id is required" });
  }

  try {
    // Load session to validate ownership and get gym_id
    const sessRef = firestore.collection("session").doc(session_id);
    const sessSnap = await sessRef.get();
    if (!sessSnap.exists) {
      return res.status(404).json({ error: "Session not found" });
    }
    const sessData = sessSnap.data() as any;
    const gymId = String(sessData?.gym_id || "");

    // ✅ Safe access to session.user
    const user = session.user as any;
    const userRole = user?.role as string | undefined;

    // Gym owners must own this gym; admins always allowed
    const ownerOk = isGymOwner(session, gymId);
    const adminOk = userRole === "admin";
    if (!ownerOk && !adminOk) {
      return res.status(403).json({ error: "Not owner of this gym" });
    }

    // Create single-use token doc
    const token = generateToken();
    const expires_at = minutesFromNow(Math.max(1, Math.min(1440, Number(expires_in_minutes)))); // cap at 24h

    await firestore.collection("bookingTokens").doc(token).set({
      token,
      session_id,
      gym_id: gymId,
      created_by: user?.email || user?.id || null,
      created_at: new Date(),
      expires_at,
      used: false,
      max_use: 1,
    });

    // Build link for WhatsApp or direct click
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.VERCEL_URL?.startsWith("http")
        ? (process.env.VERCEL_URL as string)
        : `https://${process.env.VERCEL_URL || "localhost:3000"}`;

    // Fallback to localhost in dev if NEXT_PUBLIC_BASE_URL not set
    const safeBase =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const link = `${safeBase}/api/book/${encodeURIComponent(token)}`;

    return res.status(200).json({
      ok: true,
      token,
      link,
      expires_at,
    });
  } catch (err: any) {
    console.error("Generate link error:", err?.message || err);
    return res.status(500).json({ error: "Failed to generate link" });
  }
}
