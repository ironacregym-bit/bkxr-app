
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.query as { token?: string };
  if (!token) return res.status(400).json({ error: "Missing token" });

  const session = await getServerSession(req, res, authOptions);
  const { name, email } = req.body || {};

  try {
    const tokenRef = firestore.collection("bookingTokens").doc(token);
    const bookingsCol = firestore.collection("bookings");

    let sessData: any;

    await firestore.runTransaction(async (tx) => {
      const tSnap = await tx.get(tokenRef);
      if (!tSnap.exists) throw new Error("Invalid token");
      const tData = tSnap.data() as any;
      if (tData.used) throw new Error("Token already used");
      if (Date.now() > Number(tData.expires_at)) throw new Error("Token expired");

      const sessionId = String(tData.session_id);
      const sessRef = firestore.collection("session").doc(sessionId);
      const sSnap = await tx.get(sessRef);
      if (!sSnap.exists) throw new Error("Session not found");
      sessData = sSnap.data();
      const max = Number(sessData?.max_attendance) || 0;

      const confirmedSnap = await bookingsCol
        .where("session_id", "==", sessionId)
        .where("status", "==", "confirmed")
        .get();
      if (max > 0 && confirmedSnap.size >= max) throw new Error("Session is full");

      const bookingId = `${sessionId}_${session ? "user" : "guest"}_${token}`;
      tx.set(bookingsCol.doc(bookingId), {
        booking_id: bookingId,
        session_id: sessionId,
        user_id: session ? session.user?.email : null,
        guest_name: session ? null : name || null,
        guest_email: session ? null : email || null,
        status: "confirmed",
        source: "whatsapp",
        created_at: new Date(),
      });

      tx.update(tokenRef, { used: true, used_at: new Date() });
    });

    return res.status(200).json({
      ok: true,
      message: "Booking confirmed",
      session: {
        class_name: sessData?.class_name,
        gym_name: sessData?.gym_name,
        start_time: sessData?.start_time,
      },
    });
  } catch (err: any) {
    const msg = err.message || "Failed to confirm booking";
    const code = ["Invalid token", "Token already used", "Token expired", "Session is full"].includes(msg) ? 400 : 500;
    return res.status(code).json({ error: msg });
  }
}
