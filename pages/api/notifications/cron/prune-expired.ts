
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const usersSnap = await firestore.collection("users").select().get();
    const now = Date.now();
    let pruned = 0;

    for (const doc of usersSnap.docs) {
      const email = doc.id;
      const coll = firestore.collection("user_notifications").doc(email).collection("items");
      const snap = await coll.orderBy("created_at      const snap = await coll.orderBy("created_at", "desc").limit(100).get();
      const batch = firestore.batch();

      for (const d of snap.docs) {
        const x = d.data() as any;
        const expires_at =
          typeof x.expires_at === "string"
            ? x.expires_at
            : x.expires_at?.toDate?.()
            ? x.expires_at.toDate().toISOString()
            : null;
        const exp = expires_at ? Date.parse(expires_at) : NaN;
        if (!isNaN(exp) && exp <= now) {
          batch.delete(d.ref);
          pruned++;
        }
      }

      if (pruned > 0) await batch.commit();
    }

    return res.status(200).json({ ok: true, pruned });
  } catch (e: any) {
    console.error("[notifications/prune-expired]", e?.message || e);
    return res.status(500).json({ error: "Failed to prune expired notifications" });
  }
}
