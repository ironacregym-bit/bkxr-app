import { getServerSession } from "next-auth";
import type { NextApiRequest, NextApiResponse } from "next";
import { authOptions } from "@/lib/auth";
import { firestore } from "@pt/firebase";
import { canEditSite } from "@/lib/sitebuilder/access";
import {
  domainRequestSchema,
  findSiteDomain,
  normalizeCustomDomain,
  readDomainVerification,
  upsertSiteDomain,
  type DomainVerificationChallenge,
} from "@/lib/sitebuilder/domains";
import {
  domainOwnershipRecord,
  hasDomainOwnershipRecord,
} from "@/lib/sitebuilder/domain-ownership";
import { nowIso } from "@/lib/sitebuilder/model";
import {
  isVercelDomainProvisioningConfigured,
  VercelDomainError,
  verifyVercelProjectDomain,
} from "@/lib/sitebuilder/vercel-domains";

type Resp =
  | {
      ok: true;
      host: string;
      status: "active";
      verification: DomainVerificationChallenge[];
    }
  | {
      ok: false;
      error: string;
      detail?: string;
      verification?: DomainVerificationChallenge[];
      ownershipRecord?: DomainVerificationChallenge;
    };

class DomainRequestError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string
  ) {
    super(code);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const parsed = domainRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "INVALID_INPUT" });
  }

  const host = normalizeCustomDomain(parsed.data.host);
  if (!host) {
    return res.status(400).json({ ok: false, error: "INVALID_HOST" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email?.trim().toLowerCase() || "";
  if (!email) {
    return res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });
  }

  const siteRef = firestore
    .collection("sitebuilder_sites")
    .doc(parsed.data.siteId);
  const hostRef = firestore.collection("sitebuilder_hosts").doc(host);
  let ownershipRecord: DomainVerificationChallenge | undefined;

  try {
    const [siteSnapshot, hostSnapshot] = await Promise.all([
      siteRef.get(),
      hostRef.get(),
    ]);
    if (!siteSnapshot.exists) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    const site = siteSnapshot.data() || {};
    const mapping = hostSnapshot.exists ? hostSnapshot.data() || {} : {};
    if (!canEditSite(site, email)) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    if (
      mapping.siteId &&
      String(mapping.siteId) !== parsed.data.siteId
    ) {
      return res.status(409).json({ ok: false, error: "HOST_IN_USE" });
    }
    if (
      !site.tenantId ||
      (mapping.tenantId &&
        String(mapping.tenantId) !== String(site.tenantId))
    ) {
      return res.status(409).json({ ok: false, error: "TENANT_MISMATCH" });
    }

    const siteDomain = findSiteDomain(site.domains, host);
    const ownershipToken =
      typeof siteDomain?.ownershipToken === "string"
        ? siteDomain.ownershipToken
        : "";
    if (!ownershipToken) {
      return res.status(409).json({
        ok: false,
        error: "OWNERSHIP_CHALLENGE_NOT_FOUND",
        detail: "Add the domain again to generate a SiteBuilder ownership record.",
      });
    }

    ownershipRecord = domainOwnershipRecord(host, ownershipToken);
    const hasOwnershipRecord = await hasDomainOwnershipRecord(
      host,
      ownershipToken
    );
    if (!hasOwnershipRecord) {
      return res.status(409).json({
        ok: false,
        error: "DOMAIN_OWNERSHIP_NOT_VERIFIED",
        detail:
          "Add the SiteBuilder TXT record at your DNS provider, wait for it to propagate, then try again.",
        verification: readDomainVerification(siteDomain?.verification),
        ownershipRecord,
      });
    }

    if (!isVercelDomainProvisioningConfigured()) {
      return res.status(503).json({
        ok: false,
        error: "DOMAIN_PROVISIONING_NOT_CONFIGURED",
      });
    }

    const vercelDomain = await verifyVercelProjectDomain(host);
    const now = nowIso();
    const status = vercelDomain.verified ? "active" : "pending";
    await firestore.runTransaction(async (transaction) => {
      const [currentSiteSnapshot, currentHostSnapshot] = await Promise.all([
        transaction.get(siteRef),
        transaction.get(hostRef),
      ]);
      if (!currentSiteSnapshot.exists) {
        throw new DomainRequestError(404, "NOT_FOUND");
      }

      const currentSite = currentSiteSnapshot.data() || {};
      const currentMapping = currentHostSnapshot.exists
        ? currentHostSnapshot.data() || {}
        : {};
      if (!canEditSite(currentSite, email)) {
        throw new DomainRequestError(403, "FORBIDDEN");
      }
      const currentTenantId = String(currentSite.tenantId || "").trim();
      const currentSlug = String(currentSite.slug || "").trim();
      if (
        !currentTenantId ||
        !currentSlug ||
        (currentMapping.siteId &&
          String(currentMapping.siteId) !== parsed.data.siteId) ||
        (currentMapping.tenantId &&
          String(currentMapping.tenantId) !== currentTenantId)
      ) {
        throw new DomainRequestError(409, "HOST_IN_USE");
      }

      const currentDomain = findSiteDomain(currentSite.domains, host);
      if (currentDomain?.ownershipToken !== ownershipToken) {
        throw new DomainRequestError(409, "OWNERSHIP_CHALLENGE_CHANGED");
      }

      if (status === "active") {
        transaction.set(
          hostRef,
          {
            host,
            siteId: parsed.data.siteId,
            tenantId: currentTenantId,
            status,
            slug: currentSlug,
            verification: vercelDomain.verification || [],
            ownershipVerifiedAt: now,
            verified_at: now,
            updated_at: now,
            ...(currentMapping.created_at ? {} : { created_at: now }),
          },
          { merge: true }
        );
      } else if (currentHostSnapshot.exists) {
        transaction.delete(hostRef);
      }

      transaction.set(
        siteRef,
        {
          domains: upsertSiteDomain(
            currentSite.domains,
            host,
            status,
            vercelDomain.verification || [],
            now,
            status === "active" ? null : ownershipToken
          ),
          updated_at: now,
        },
        { merge: true }
      );
    });

    if (!vercelDomain.verified) {
      return res.status(409).json({
        ok: false,
        error: "DOMAIN_NOT_VERIFIED",
        detail:
          "Vercel has not verified the domain yet. Add its DNS verification record and try again.",
        verification: vercelDomain.verification || [],
        ownershipRecord,
      });
    }

    return res.status(200).json({
      ok: true,
      host,
      status: "active",
      verification: vercelDomain.verification || [],
    });
  } catch (error) {
    if (error instanceof DomainRequestError) {
      return res.status(error.statusCode).json({
        ok: false,
        error: error.code,
      });
    }
    if (error instanceof VercelDomainError) {
      return res.status(error.statusCode).json({
        ok: false,
        error: "VERCEL_DOMAIN_ERROR",
        detail: error.message,
        verification: error.verification,
        ownershipRecord,
      });
    }

    console.error("[sitebuilder/domains/verify] failed:", error);
    return res.status(500).json({ ok: false, error: "VERIFY_FAILED" });
  }
}
