
// /pages/api/admin/members/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";
import { hasRole } from "../../../../lib/rbac";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !hasRole(session, ["admin", "gym"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const limit = Math.min(Number(req.query.limit || 50), 100);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;

  try {
    let q = firestore.collection("users").orderBy("__name__").limit(limit);
    if (cursor) q = q.startAfter(cursor);

    const snap = await q.get();
    const items = snap.docs.map((d) => {
      const data = d.data() || {};
      const name = data.display_name || data.name || data?.profile?.name || null;
      const membership_status = data.membership_status || null;
      const subscription_status = data.subscription_status || null;

      // Normalise updated_at if present
      let updated_at: string | null = null;
      const u = data.updated_at;
      if (u?.toDate) updated_at = u.toDate().toISOString();
      else if (typeof u === "string") updated_at = u;
      return {
        email: d.id,
        name,
        membership_status,
        subscription_status,
        updated_at,
      };
    });

    const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1].id : null;

    return res.status(200).json({ items, nextCursor });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}
``
