
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token, name, phone } = req.query as { token?: string; name?: string; phone?: string };
  if (!token || typeof token !== "string") return res.status(400).json({ error: "Missing token" });

  try {
    const tokenRef = firestore.collection("bookingTokens").doc(token);
    const bookingsCol = firestore.collection("bookings");

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
      const sData = sSnap.data() as any;
      const max = Number(sData?.max_attendance) || 0;

      const confirmedSnap = await bookingsCol
        .where("session_id", "==", sessionId)
        .where("status", "==", "confirmed")
        .get();
      if (max > 0 && confirmedSnap.size >= max) throw new Error("Session is full");

      const bookingId = `${sessionId}_guest_${token}`;
      tx.set(bookingsCol.doc(bookingId), {
        booking_id: bookingId,
        session_id: sessionId,
        user_id: null,
        status: "confirmed",
        created_at: new Date(),
        guest_name: name || null,
        guest_phone: phone || null,
      });

      tx.update(tokenRef, { used: true, used_at: new Date() });
    });

    return res.status(200).json({ ok: true, message: "Booking confirmed" });
  } catch (err: any) {
    const msg = err.message || "Failed to confirm booking";
    const code = ["Invalid token", "Token already used", "Token expired", "Session is full"].includes(msg) ? 400 : 500;
    return res.status(code).json({ error: msg });
  }
}
