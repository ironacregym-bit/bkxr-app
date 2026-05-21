// File: pages/api/sitebuilder/create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";
import { defaultSiteContent, nowIso, slugify, validateSlug } from "../../../SiteBuilder/lib/model";

type Resp =
  | { ok: true; siteId: string; slug: string }
  | { ok: false; error: string; detail?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email ? String(session.user.email).toLowerCase() : "";
  if (!email) return res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });

  const rawSlug = String((req.body as any)?.slug || "");
  const name = String((req.body as any)?.name || "").trim();

  const slug = slugify(rawSlug);
  const vErr = validateSlug(slug);
  if (vErr) return res.status(400).json({ ok: false, error: "INVALID_SLUG", detail: vErr });

  const sitesCol = firestore.collection("sitebuilder_sites");
  const slugsCol = firestore.collection("sitebuilder_slugs");

  // Unique slug lock pattern:
  // - sitebuilder_slugs/{slug} is the lock doc
  // - if it exists, slug is taken
  try {
    const createdAt = nowIso();
    const siteRef = sitesCol.doc(); // auto id
    const slugRef = slugsCol.doc(slug);

    await firestore.runTransaction(async (tx) => {
      const slugSnap = await tx.get(slugRef);
      if (slugSnap.exists) {
        throw Object.assign(new Error("SLUG_TAKEN"), { code: "SLUG_TAKEN" });
      }

      tx.set(slugRef, {
        slug,
        siteId: siteRef.id,
        owner_email: email,
        created_at: createdAt,
      });

      const siteDoc = defaultSiteContent({ slug, ownerEmail: email, name });
      tx.set(siteRef, {
        ...siteDoc,
        id: siteRef.id,
      });
    });

    return res.status(200).json({ ok: true, siteId: siteRef.id, slug });
  } catch (e: any) {
    const msg = String(e?.code || e?.message || "");
    if (msg.includes("SLUG_TAKEN")) {
      return res.status(409).json({ ok: false, error: "SLUG_TAKEN", detail: "That slug is already in use" });
    }
    // eslint-disable-next-line no-console
    console.error("[sitebuilder/create] failed:", e);
    return res.status(500).json({ ok: false, error: "CREATE_FAILED", detail: e?.message });
  }
}
