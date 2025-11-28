
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const email = req.query.email as string;
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  try {
    const docRef = firestore.collection("users").doc(email);

    if (req.method === "GET") {
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const data = docSnap.data() || {};

      return res.status(200).json({
        email: data.email || email,
        name: data.name || "",
        image: data.image || "",
        DOB: data.DOB || "",
        sex: data.sex || "",
        height_cm: data.height_cm ?? null,
        weight_kg: data.weight_kg ?? null,
        bodyfat_pct: data.bodyfat_pct ?? null,
        activity_factor: data.activity_factor ?? null,
        caloric_target: data.caloric_target ?? null,
        created_at: data.created_at || "",
        last_login_at: data.last_login_at || "",
        trainer_email: "ironacregym@gmail.com",
        trainer_phone: "+447860861120"
      });
    }

    if (req.method === "PATCH") {
      const updates = req.body;
      await docRef.set(updates, { merge: true });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("Profile API error:", err.message);
    return res.status(500).json({ error: "Failed to process profile request" });
  }
}
