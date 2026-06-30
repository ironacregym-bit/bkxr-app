// pages/api/notifications/dismiss.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { Timestamp } from "@google-cloud/firestore";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type Resp =
  | {
      ok: true;
      user_id: string;
      id: string;
    }
  | {
      error: string;
    };

type Body = {
  id?: string;
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
    const body = (req.body || {}) as Body;
    const id = String(body?.id || "").trim();

    if (!id) {
      return res.status(400).json({ error: "Notification id is required" });
    }

    const ref = firestore.collection("user_notifications").doc(userId).collection("items").doc(id);

    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ error: "Notification not found" });
    }

    const now = Timestamp.now();

    await ref.set(
      {
        dismissed_at: now,
        updated_at: now,
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      user_id: userId,
      id,
    });
  } catch (err: any) {
    console.error("[notifications/dismiss] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to dismiss notification" });
  }
}
