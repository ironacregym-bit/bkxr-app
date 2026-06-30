// pages/api/notifications/clear-all.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { Timestamp } from "@google-cloud/firestore";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type Resp =
  | {
      ok: true;
      user_id: string;
      updated: number;
    }
  | {
      error: string;
    };

function getNotificationUserId(session: any): string {
  return String(session?.user?.email || "").trim().toLowerCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions).catch(() => null);
  const userId = getNotificationUserId(session);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const itemsRef = firestore.collection("user_notifications").doc(userId).collection("items");

    const snap = await itemsRef.orderBy("created_at", "desc").limit(200).get();

    if (snap.empty) {
      return res.status(200).json({
        ok: true,
        user_id: userId,
        updated: 0,
      });
    }

    const now = Timestamp.now();
    const batch = firestore.batch();

    let updated = 0;

    snap.docs.forEach((doc) => {
      const data = doc.data() || {};

      if (data.dismissed_at) return;

      batch.set(
        doc.ref,
        {
          dismissed_at: now,
          updated_at: now,
        },
        { merge: true }
      );

      updated += 1;
    });

    if (updated > 0) {
      await batch.commit();
    }

    return res.status(200).json({
      ok: true,
      user_id: userId,
      updated,
    });
  } catch (err: any) {
    console.error("[notifications/clear-all] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to clear notifications" });
  }
}
