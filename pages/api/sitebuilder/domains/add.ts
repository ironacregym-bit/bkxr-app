// File: pages/api/sitebuilder/domains/add.ts
import type { getServerSession } from "next-auth";
import type { NextApiRequest, NextApiResponse } from "next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";
import { makeVerificationToken, normalizeHost, nowIso } from "../../../../SiteBuilder/lib/model";

type Resp =
  | { ok: true; host: string; verificationToken: string; txtName: string; txtValue: string }
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

  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email ? String(session.user.email).toLowerCase() : "";
  if (!email) return res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });

  const siteId = String((req.body as any)?.siteId || "").trim();
  const hostRaw = String((req.body as any)?.host || "");

  if (!siteId) return res.status(400).json({ ok: false, error: "MISSING_SITE_ID" });
  const host = normalizeHost(hostRaw);
  if (!host) return res.status(400).json({ ok: false, error: "INVALID_HOST", detail: "Enter a valid domain host" });

  // Don’t allow claiming your own base host or vercel host
  const baseHost = normalizeHost(process.env.SITEBUILDER_BASE_HOST || "");
  if (baseHost && host === baseHost) return res.status(400).json({ ok: false, error: "INVALID_HOST" });
  if (host.endsWith(".vercel.app")) return res.status(400).json({ ok: false, error: "INVALID_HOST" });

  const token = makeVerificationToken();
  const now = nowIso();

  // TXT record convention:
  // _sitebuilder.<domain> = sitebuilder-verification=<token>
  const txtName = `_sitebuilder.${host}`;
  const txtValue = `sitebuilder-verification=${token}`;

  try {
    const siteRef = firestore.collection("sitebuilder_sites").doc(siteId);
    const snap = await siteRef.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const site = snap.data() || {};
    if (!canEditSite(site, email)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const domains: any[] = Array.isArray(site.domains) ? site.domains : [];
    const exists = domains.some((d) => normalizeHost(d?.host) === host);
    if (exists) return res.status(409).json({ ok: false, error: "ALREADY_ADDED" });

    domains.push({
      host,
      status: "pending",
      verificationToken: token,
      addedAt: now,
    });

    await siteRef.set(
      {
        domains,
        updated_at: now,
      },
      { merge: true }
    );

    // Record host mapping for later automation / auditing
    await firestore.collection("sitebuilder_hosts").doc(host).set(
      {
        host,
        siteId,
        status: "pending",
        created_at: now,
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true, host, verificationToken: token, txtName, txtValue });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[sitebuilder/domains/add] failed:", e);
    return res.status(500).json({ ok: false, error: "ADD_FAILED", detail: e?.message });
  }
}
