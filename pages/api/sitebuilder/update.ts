// File: pages/api/sitebuilder/update.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";
import { nowIso } from "../../../SiteBuilder/lib/model";
import { sanitizeSitePatch } from "../../../SiteBuilder/lib/patch";

type Resp =
  | { ok: true; site: any }
  | { ok: false; error: string; detail?: string };

function toLower(v: any) {
  return String(v || "").trim().toLowerCase();
}

function canEditSite(site: any, email: string) {
  const e = toLower(email);
  if (!e) return false;
  if (toLower(site?.owner_email) === e) return true;
  const editors: string[] = Array.isArray(site?.editor_emails) ? site.editor_emails : [];
  return editors.map((x) => toLower(x)).includes(e);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email ? String(session.user.email).toLowerCase() : "";
  if (!email) return res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });

  const siteId = String((req.body as any)?.siteId || "").trim();
  const patch = (req.body as any)?.patch;

  if (!siteId) return res.status(400).json({ ok: false, error: "MISSING_SITE_ID" });

  try {
    const ref = firestore.collection("sitebuilder_sites").doc(siteId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const site = snap.data() || {};
    if (!canEditSite(site, email)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const clean = sanitizeSitePatch(patch);
    const updated_at = nowIso();

    const merged = {
      ...site,
      ...clean,
      // keep immutable-ish fields
      id: siteId,
      slug: site.slug,
      owner_email: site.owner_email,
      editor_emails: site.editor_emails || [],
      created_at: site.created_at || updated_at,
      updated_at,
    };

    await ref.set(merged, { merge: false });

    return res.status(200).json({ ok: true, site: merged });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[sitebuilder/update] failed:", e);
    return res.status(500).json({ ok: false, error: "UPDATE_FAILED", detail: e?.message });
  }
}
