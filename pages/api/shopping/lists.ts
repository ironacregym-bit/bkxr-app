
// pages/api/shopping/lists.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type ListMeta = { id: string; name: string; people: number; created_at: string; updated_at: string };
const isoNow = () => new Date().toISOString();
const toNumber = (x: any, d = 1) => (Number.isFinite(Number(x)) ? Number(x) : d);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  const listsCol = firestore.collection("shopping_lists").doc(email).collection("lists");
  const itemsCol = firestore.collection("shopping_lists").doc(email).collection("items");

  try {
    if (req.method === "GET") {
      const snap = await listsCol.orderBy("created_at", "desc").get();
      const lists: ListMeta[] = snap.docs.map((d) => {
        const x = d.data() as any;
        return {
          id: d.id,
          name: String(x.name || "My List"),
          people: toNumber(x.people, 1),
          created_at: x.created_at || isoNow(),
          updated_at: x.updated_at || isoNow(),
        };
      });
      return res.status(200).json({ lists });
    }

    if (req.method === "POST") {
      const { name, people } = (req.body || {}) as { name?: string; people?: number };
      const n = String(name || "").trim() || "My List";
      const p = toNumber(people, 1);
      const now = isoNow();
      const ref = await listsCol.add({ name: n, people: p, created_at: now, updated_at: now });
      return res.status(201).json({ list: { id: ref.id, name: n, people: p, created_at: now, updated_at: now } });
    }

    if (req.method === "PATCH") {
      const { id, name, people } = (req.body || {}) as { id?: string; name?: string; people?: number };
      if (!id) return res.status(400).json({ error: "id required" });
      const patch: any = { updated_at: isoNow() };
      if (name !== undefined) patch.name = String(name || "").trim();
      if (people !== undefined) patch.people = toNumber(people, 1);
      await listsCol.doc(id).set(patch, { merge: true });
      const doc = await listsCol.doc(id).get();
      const x = doc.data() as any;
      return res.status(200).json({ list: { id, name: x.name, people: x.people, created_at: x.created_at, updated_at: x.updated_at } });
    }

    if (req.method === "DELETE") {
      const { id } = (req.body || {}) as { id?: string };
      if (!id) return res.status(400).json({ error: "id required" });

      const listRef = listsCol.doc(id);
      const batch = firestore.batch();

      // delete items belonging to this list
      const itemsSnap = await itemsCol.where("list_id", "==", id).get();
      itemsSnap.forEach((d) => batch.delete(d.ref));

      // delete list-attached recipes (if created)
      const recipesSnap = await listRef.collection("recipes").get();
      recipesSnap.forEach((d) => batch.delete(d.ref));

      batch.delete(listRef);
      await batch.commit();
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    console.error("[shopping/lists]", e?.message || e);
    return res.status(500).json({ error: "Lists error" });
  }
}
