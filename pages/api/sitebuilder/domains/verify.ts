// File: pages/api/sitebuilder/domains/verify.ts
import { getServerSession } from "next-auth";
import type { NextApiRequest, NextApiResponse } from "next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";
import { normalizeHost, nowIso } from "../../../../SiteBuilder/lib/model";
import dns from "dns/promises";

type Resp =
  | { ok: true; host: string; status: "verified" }
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

async function readTxt(host: string) {
  // Read TXT for _sitebuilder.<host>
  const name = `_sitebuilder.${host}`;
  const records = await dns.resolveTxt(name);
  const flat = records.map((arr) => arr.join("")).filter(Boolean);
  return flat;
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
  if (!host) return res.status(400).json({ ok: false, error: "INVALID_HOST" });

  try {
    const siteRef = firestore.collection("sitebuilder_sites").doc(siteId);
    const snap = await siteRef.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const site = snap.data() || {};
    if (!canEditSite(site, email)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const domains: any[] = Array.isArray(site.domains) ? site.domains : [];
    const idx = domains.findIndex((d) => normalizeHost(d?.host) === host);
    if (idx < 0) return res.status(404).json({ ok: false, error: "DOMAIN_NOT_ADDED" });

    const token = String(domains[idx]?.verificationToken || "").trim();
    if (!token) return res.status(400).json({ ok: false, error: "MISSING_TOKEN" });

    const expected = `sitebuilder-verification=${token}`;

    let txt: string[] = [];
    try {
      txt = await readTxt(host);
    } catch (e: any) {
      return res.status(400).json({
        ok: false,
        error: "TXT_NOT_FOUND",
        detail: "TXT record not found yet. DNS can take time to propagate.",
      });
    }

    const found = txt.some((v) => String(v || "").includes(expected));
    if (!found) {
      return res.status(400).json({
        ok: false,
        error: "TXT_MISMATCH",
        detail: "TXT record found, but the verification value does not match yet.",
      });
    }

    const now = nowIso();
    domains[idx] = {
      ...domains[idx],
      status: "verified",
      verifiedAt: now,
    };

    await siteRef.set({ domains, updated_at: now }, { merge: true });

    await firestore.collection("sitebuilder_hosts").doc(host).set(
      {
        host,
        siteId,
        status: "verified",
        verified_at: now,
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true, host, status: "verified" });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[sitebuilder/domains/verify] failed:", e);
    return res.status(500).json({ ok: false, error: "VERIFY_FAILED", detail: e?.message });
  }
}
