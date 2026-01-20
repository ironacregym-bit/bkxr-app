
// pages/api/shopping/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  const coll = firestore.collection("shopping_lists").doc(email).collection("items");

  try {
    if (req.method === "GET") {
      const snap = await coll.orderBy("added_at", "desc").limit(200).get();
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      return res.status(200).json({ items });
    }

    if (req.method === "POST") {
      const { name, qty, unit } = (req.body || {}) as { name?: string; qty?: number|null; unit?: string|null };
      if (!name || !String(name).trim()) return res.status(400).json({ error: "name required" });
      const doc = coll.doc();
      await doc.set({
        name: String(name).trim(),
        qty: typeof qty === "number" ? qty : null,
        unit: unit ? String(unit) : null,
        done: false,
        added_at: new Date().toISOString(),
      }, { merge: true });
      return res.status(200).json({ ok: true, id: doc.id });
    }

    if (req.method === "PATCH") {
      const { id, done, name, qty, unit } = (req.body || {}) as { id?: string; done?: boolean; name?: string; qty?: number|null; unit?: string|null };
      if (!id) return res.status(400).json({ error: "id required" });
      const patch: any = {};
      if (typeof done === "boolean") patch.done = done;
      if (typeof name === "string") patch.name = name.trim();
      if (typeof qty === "number") patch.qty = qty;
      if (typeof unit === "string") patch.unit = unit;
      if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No fields to update" });
      await coll.doc(id).set(patch, { merge: true });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const { id } = (req.body || {}) as { id?: string };
      if (!id) return res.status(400).json({ error: "id required" });
      await coll.doc(id).delete();
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    console.error("[shopping/list]", e?.message || e);
    return res.status(500).json({ error: "Shopping list error" });
  }
}
