// File: pages/api/sitebuilder/editors/update.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";
import { nowIso } from "../../../../SiteBuilder/lib/model";

type Resp =
  | {
      ok: true;
      owner_email: string;
      editor_emails: string[];
    }
  | { ok: false; error: string; detail?: string };

function toLower(v: any) {
  return String(v || "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const session = await getServerSession(req, res, authOptions);
  const currentEmail = session?.user?.email ? String(session.user.email).toLowerCase() : "";

  if (!currentEmail) {
    return res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });
  }

  const siteId = String((req.body as any)?.siteId || "").trim();
  const action = String((req.body as any)?.action || "").trim().toLowerCase();
  const targetEmail = toLower((req.body as any)?.email);

  if (!siteId) {
    return res.status(400).json({ ok: false, error: "MISSING_SITE_ID" });
  }

  if (!targetEmail || !isValidEmail(targetEmail)) {
    return res.status(400).json({ ok: false, error: "INVALID_EMAIL" });
  }

  if (action !== "add" && action !== "remove") {
    return res.status(400).json({ ok: false, error: "INVALID_ACTION" });
  }

  try {
    const ref = firestore.collection("sitebuilder_sites").doc(siteId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    const site = snap.data() || {};
    const owner_email = toLower(site.owner_email);

    // Only owner can manage access
    if (owner_email !== currentEmail) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    let editor_emails: string[] = Array.isArray(site.editor_emails)
      ? site.editor_emails.map((x: any) => toLower(x)).filter(Boolean)
      : [];

    // Never allow owner to be inserted into editors
    if (targetEmail === owner_email) {
      return res.status(400).json({ ok: false, error: "INVALID_TARGET", detail: "Owner already has access" });
    }

    if (action === "add") {
      if (!editor_emails.includes(targetEmail)) {
        editor_emails = [...editor_emails, targetEmail];
      }
    }

    if (action === "remove") {
      editor_emails = editor_emails.filter((x) => x !== targetEmail);
    }

    await ref.set(
      {
        editor_emails,
        updated_at: nowIso(),
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      owner_email,
      editor_emails,
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[sitebuilder/editors/update] failed:", e);

    return res.status(500).json({
      ok: false,
      error: "UPDATE_FAILED",
      detail: e?.message || "Unknown error",
    });
  }
}
