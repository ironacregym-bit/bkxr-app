// pages/api/notifications/mark-all-read.ts
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

function getUserId(session: any): string {
  const raw =
    String(session?.user?.uid || "").trim() ||
    String(session?.user?.id || "").trim() ||
    String(session?.user?.email || "").trim().toLowerCase();

  return raw;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions).catch(() => null);
  const userId = getUserId(session);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const itemsRef = firestore.collection("user_notifications").doc(userId).collection("items");

    const unreadSnap = await itemsRef.where("read_at", "==", null).get();

    if (unreadSnap.empty) {
      return res.status(200).json({
        ok: true,
        user_id: userId,
        updated: 0,
      });
    }

    const now = Timestamp.now();
    const batch = firestore.batch();

    unreadSnap.docs.forEach((doc) => {
      batch.set(
        doc.ref,
        {
          read_at: now,
          updated_at: now,
        },
        { merge: true }
      );
    });

    await batch.commit();

    return res.status(200).json({
      ok: true,
      user_id: userId,
      updated: unreadSnap.size,
    });
  } catch (err: any) {
    console.error("[notifications/mark-all-read] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to mark notifications as read" });
  }
}
