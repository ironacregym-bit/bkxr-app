
// pages/api/admin/notifications/prune-expired.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";

const CRON_KEY = process.env.CRON_KEY;

function toIso(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v?.toDate) try { return v.toDate().toISOString(); } catch { return null; }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["GET", "POST"].includes(req.method || "")) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (CRON_KEY && req.headers["x-cron-key"] !== CRON_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const usersSnap = await firestore.collection("users").select().get();
    const nowMs = Date.now();
    let totalPruned = 0, usersTouched = 0;

    for (const doc of usersSnap.docs) {
      const email = doc.id;
      const coll = firestore.collection("user_notifications").doc(email).collection("items");
      const snap = await coll.orderBy("created_at", "desc").limit(100).get();

      const batch = firestore.batch();
      let pruned = 0;

      for (const d of snap.docs) {
        const x = d.data() as any;
        const iso = toIso(x.expires_at);
        const expMs = iso ? Date.parse(iso) : NaN;
        if (!isNaN(expMs) && expMs <= nowMs) {
          batch.delete(d.ref);
          pruned++;
        }
      }

      if (pruned > 0) {
        await batch.commit();
        totalPruned += pruned;
        usersTouched++;
      }
    }

    return res.status(200).json({ ok: true, totalPruned, usersTouched });
  } catch (e: any) {
    console.error("[notifications/prune-expired]", e?.message || e);
    return res.status(500).json({ error: "Failed to prune expired notifications" });
  }
}
