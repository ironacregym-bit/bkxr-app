import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient"; // Firestore client

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });
  }

  const { email, name = "", image = "" } = req.body || {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ ok: false, error: "INVALID_EMAIL" });
  }

  try {
    const docRef = firestore.collection("users").doc(email);
    const docSnap = await docRef.get();

    const nowIso = new Date().toISOString();

    if (!docSnap.exists) {
      // New user → create document with placeholders
      await docRef.set({
        email,
        name,
        image,
        created_at: nowIso,
        last_login_at: nowIso,
        DOB: "",
        sex: "",
        height_cm: null,
        weight_kg: null,
        bodyfat_pct: null,
        activity_factor: null,
        caloric_target: null
      });
    } else {
      // Existing user → update name, image, last_login_at
      await docRef.update({
        name,
        image,
        last_login_at: nowIso
      });
    }

    return res.json({ ok: true });
  } catch (e: any) {
    console.error("USER_UPSERT_FAILED:", e.message);
    return res.status(500).json({
      ok: false,
      error: "USER_UPSERT_FAILED",
      detail: e?.message
    });
  }
}
