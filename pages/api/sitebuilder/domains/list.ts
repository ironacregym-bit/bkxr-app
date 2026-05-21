// File: pages/api/sitebuilder/domains/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

type Resp =
  | { ok: true; domains: any[] }
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

  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email ? String(session.user.email).toLowerCase() : "";
  if (!email) return res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });

  const siteId = String(req.query.siteId || "").trim();
  if (!siteId) return res.status(400).json({ ok: false, error: "MISSING_SITE_ID" });

  try {
    const ref = firestore.collection("sitebuilder_sites").doc(siteId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const site = snap.data() || {};
    if (!canEditSite(site, email)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const domains = Array.isArray(site.domains) ? site.domains : [];
    return res.status(200).json({ ok: true, domains });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[sitebuilder/domains/list] failed:", e);
    return res.status(500).json({ ok: false, error: "LIST_FAILED", detail: e?.message });
  }
}
