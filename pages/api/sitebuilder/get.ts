// File: pages/api/sitebuilder/get.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type Resp =
  | { ok: true; site: any; canEdit: boolean }
  | { ok: false; error: string; detail?: string };

function toLower(s: any) {
  return String(s || "").trim().toLowerCase();
}

function canEdit(site: any, email: string) {
  const e = toLower(email);
  if (!e) return false;
  if (toLower(site?.owner_email) === e) return true;
  const editors: string[] = Array.isArray(site?.editor_emails) ? site.editor_emails : [];
  return editors.map((x) => toLower(x)).includes(e);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email ? String(session.user.email).toLowerCase() : "";

  const siteId = String(req.query.siteId || "").trim();
  const slug = String(req.query.slug || "").trim().toLowerCase();

  if (!siteId && !slug) return res.status(400).json({ ok: false, error: "MISSING_PARAM", detail: "Provide siteId or slug" });

  try {
    let id = siteId;

    if (!id) {
      const slugSnap = await firestore.collection("sitebuilder_slugs").doc(slug).get();
      if (!slugSnap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const sd: any = slugSnap.data() || {};
      id = String(sd.siteId || "").trim();
      if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    const snap = await firestore.collection("sitebuilder_sites").doc(id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const site = snap.data() || {};
    const editable = canEdit(site, email);
    const published = Boolean(site.published);

    if (!published && !editable) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    return res.status(200).json({ ok: true, site: { ...site, id }, canEdit: editable });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[sitebuilder/get] failed:", e);
    return res.status(500).json({ ok: false, error: "GET_FAILED", detail: e?.message });
  }
}
