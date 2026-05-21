// File: pages/api/sitebuilder/mine.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type SiteRow = {
  id: string;
  slug: string;
  name: string;
  published: boolean;
  updated_at: string;
};

type Resp =
  | { ok: true; sites: SiteRow[] }
  | { ok: false; error: string; detail?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email ? String(session.user.email).toLowerCase() : "";
  if (!email) return res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });

  try {
    const col = firestore.collection("sitebuilder_sites");

    // Firestore has no OR query, so we run two queries and merge.
    const ownedSnap = await col.where("owner_email", "==", email).limit(100).get();
    const editSnap = await col.where("editor_emails", "array-contains", email).limit(100).get();

    const map = new Map<string, SiteRow>();

    for (const doc of ownedSnap.docs) {
      const d: any = doc.data() || {};
      map.set(doc.id, {
        id: doc.id,
        slug: String(d.slug || ""),
        name: String(d.brand?.name || "Untitled"),
        published: Boolean(d.published),
        updated_at: String(d.updated_at || d.created_at || ""),
      });
    }

    for (const doc of editSnap.docs) {
      const d: any = doc.data() || {};
      if (map.has(doc.id)) continue;
      map.set(doc.id, {
        id: doc.id,
        slug: String(d.slug || ""),
        name: String(d.brand?.name || "Untitled"),
        published: Boolean(d.published),
        updated_at: String(d.updated_at || d.created_at || ""),
      });
    }

    const sites = Array.from(map.values()).sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
    return res.status(200).json({ ok: true, sites });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[sitebuilder/mine] failed:", e);
    return res.status(500).json({ ok: false, error: "LIST_FAILED", detail: e?.message });
  }
}
