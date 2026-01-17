
// /pages/api/admin/members/nutrition.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";
import { hasRole } from "../../../../lib/rbac";

function normalise(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  const out: any = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof (v as any).toDate === "function") out[k] = (v as any).toDate().toISOString();
    else if (v && typeof v === "object") out[k] = normalise(v);
    else out[k] = v;
  }
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !hasRole(session, ["admin", "gym"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const email = typeof req.query.email === "string" ? req.query.email : "";
  if (!email) return res.status(400).json({ error: "Missing email" });

  const limit = Math.min(Number(req.query.limit || 50), 100);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;

  try {
    let q = firestore.collection("nutrition_logs").where("user_email", "==", email).orderBy("__name__").limit(limit);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();

    const items = snap.docs.map((d) => ({ id: d.id, data: normalise(d.data() || {}) }));
    const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1].id : null;

    return res.status(200).json({ items, nextCursor });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}
