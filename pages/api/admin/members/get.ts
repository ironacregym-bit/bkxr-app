
// /pages/api/admin/members/get.ts
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

  try {
    const doc = await firestore.collection("users").doc(email).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "User not found", email });
    }
    const data = normalise(doc.data() || {});
    return res.status(200).json({ email, user: data });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}
