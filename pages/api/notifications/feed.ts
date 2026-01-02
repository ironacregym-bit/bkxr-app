
// pages/api/notifications/feed.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

/**
 * Returns latest notifications for the signed-in user from:
 *   user_notifications/{email}/items
 * Optional query: ?limit=10 (default 20; max 50)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  const email = session.user.email;
  const limitParam = Number(req.query.limit);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(50, limitParam)) : 20;

  try {
    const coll = firestore.collection("user_notifications").doc(email).collection("items");
    const snap = await coll.orderBy("created_at", "desc").limit(limit).get();

    const items = snap.docs.map((d) => {
      const x = d.data() as any; // <-- fixed: single declaration
      return {
        id: d.id,
        title: String(x.title || ""),
        message: String(x.message || ""),
        href: x.href || null,
        created_at:
          typeof x.created_at === "string"
            ? x.created_at
            : x.created_at?.toDate?.()
            ? x.created_at.toDate().toISOString()
            : null,
        read_at:
          typeof x.read_at === "string"
            ? x.read_at
            : x.read_at?.toDate?.()
            ? x.read_at.toDate().toISOString()
            : null,
        delivered_channels: Array.isArray(x.delivered_channels) ? x.delivered_channels : ["in_app"],
        source_key: String(x.source_key || ""),
        source_event: x.source_event || null,
        meta: x.meta ?? null,
      };
    });

    return res.status(200).json({ items });
  } catch (e: any) {
    console.error("[notifications/feed]", e?.message || e);
    return res.status(500).json({ error: "Failed to load notifications" });
  }
}
