import { getServerSession } from "next-auth";
import type { NextApiRequest, NextApiResponse } from "next";
import { authOptions } from "@/lib/auth";
import { firestore } from "@pt/firebase";
import { canEditSite } from "@/lib/sitebuilder/access";
import {
  domainRequestSchema,
  findSiteDomain,
  normalizeCustomDomain,
  type DomainDnsTarget,
  type DomainVerificationChallenge,
  upsertSiteDomain,
} from "@/lib/sitebuilder/domains";
import {
  createDomainOwnershipToken,
  domainOwnershipRecord,
} from "@/lib/sitebuilder/domain-ownership";
import { nowIso } from "@/lib/sitebuilder/model";
import {
  addVercelProjectDomain,
  getVercelDomainDnsTargets,
  isVercelDomainProvisioningConfigured,
  VercelDomainError,
} from "@/lib/sitebuilder/vercel-domains";

type Resp =
  | {
      ok: true;
      host: string;
      status: "pending" | "active";
      verification: DomainVerificationChallenge[];
      ownershipRecord?: DomainVerificationChallenge;
      dnsTargets: DomainDnsTarget[];
    }
  | { ok: false; error: string; detail?: string };

class DomainRequestError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string
  ) {
    super(code);
  }
}

function isReservedHost(host: string) {
  const configuredHosts = [
    process.env.SITEBUILDER_BASE_HOST,
    process.env.SITEBUILDER_URL,
    ...String(process.env.SITEBUILDER_BASE_HOSTS || "").split(","),
  ]
    .map((value) => normalizeCustomDomain(String(value || "")))
    .filter((value): value is string => Boolean(value));

  return (
    host.endsWith(".vercel.app") ||
    configuredHosts.some(
      (configuredHost) =>
        host === configuredHost || host.endsWith(`.${configuredHost}`)
    )
  );
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
  if (!host || isReservedHost(host)) {
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

  try {
    const [siteSnapshot, hostSnapshot] = await Promise.all([
      siteRef.get(),
      hostRef.get(),
    ]);
    if (!siteSnapshot.exists) {
      throw new DomainRequestError(404, "NOT_FOUND");
    }

    const site = siteSnapshot.data() || {};
    if (!canEditSite(site, email)) {
      throw new DomainRequestError(403, "FORBIDDEN");
    }

    const tenantId = String(site.tenantId || "").trim();
    const slug = String(site.slug || "").trim();
    if (!tenantId || !slug) {
      throw new DomainRequestError(409, "SITE_TENANT_NOT_CONFIGURED");
    }

    const existingMapping = hostSnapshot.exists
      ? hostSnapshot.data() || {}
      : {};
    if (
      existingMapping.siteId &&
      String(existingMapping.siteId) !== parsed.data.siteId
    ) {
      throw new DomainRequestError(409, "HOST_IN_USE");
    }
    if (
      existingMapping.tenantId &&
      String(existingMapping.tenantId) !== tenantId
    ) {
      throw new DomainRequestError(409, "TENANT_MISMATCH");
    }
    if (!isVercelDomainProvisioningConfigured()) {
      return res.status(503).json({
        ok: false,
        error: "DOMAIN_PROVISIONING_NOT_CONFIGURED",
        detail:
          "SiteBuilder domain provisioning needs a Vercel access token and project ID.",
      });
    }

    const vercelDomain = await addVercelProjectDomain(host);
    const dnsTargets = await getVercelDomainDnsTargets(host);
    if (normalizeCustomDomain(vercelDomain.name) !== host) {
      throw new VercelDomainError(
        "Vercel returned a different domain than requested.",
        502
      );
    }
    const completedAt = nowIso();
    const newOwnershipToken = createDomainOwnershipToken();
    let ownershipToken = "";
    let status: "pending" | "active" = "pending";

    await firestore.runTransaction(async (transaction) => {
      const [siteSnapshot, hostSnapshot] = await Promise.all([
        transaction.get(siteRef),
        transaction.get(hostRef),
      ]);
      if (!siteSnapshot.exists) {
        throw new DomainRequestError(404, "NOT_FOUND");
      }

      const mapping = hostSnapshot.exists ? hostSnapshot.data() || {} : {};
      const site = siteSnapshot.data() || {};
      if (!canEditSite(site, email)) {
        throw new DomainRequestError(403, "FORBIDDEN");
      }
      const currentTenantId = String(site.tenantId || "").trim();
      const currentSlug = String(site.slug || "").trim();
      if (!currentTenantId || !currentSlug) {
        throw new DomainRequestError(409, "SITE_TENANT_NOT_CONFIGURED");
      }
      if (
        mapping.siteId &&
        String(mapping.siteId) !== parsed.data.siteId
      ) {
        throw new DomainRequestError(409, "HOST_IN_USE");
      }
      if (
        mapping.tenantId &&
        String(mapping.tenantId) !== currentTenantId
      ) {
        throw new DomainRequestError(409, "TENANT_MISMATCH");
      }

      const currentDomain = findSiteDomain(site.domains, host);
      const currentOwnershipToken =
        typeof currentDomain?.ownershipToken === "string"
          ? currentDomain.ownershipToken
          : "";
      const alreadyOwnershipVerified =
        String(mapping.siteId || "") === parsed.data.siteId &&
        typeof mapping.ownershipVerifiedAt === "string" &&
        Boolean(mapping.ownershipVerifiedAt.trim());
      status =
        alreadyOwnershipVerified && vercelDomain.verified
          ? "active"
          : "pending";
      ownershipToken =
        status === "pending"
          ? currentOwnershipToken || newOwnershipToken
          : "";

      if (status === "active") {
        transaction.set(
          hostRef,
          {
            host,
            siteId: parsed.data.siteId,
            tenantId: currentTenantId,
            slug: currentSlug,
            status,
            verification: vercelDomain.verification || [],
            updated_at: completedAt,
            ...(mapping.created_at ? {} : { created_at: completedAt }),
          },
          { merge: true }
        );
      } else if (hostSnapshot.exists) {
        transaction.delete(hostRef);
      }

      transaction.set(
        siteRef,
        {
          domains: upsertSiteDomain(
            site.domains,
            host,
            status,
            vercelDomain.verification || [],
            completedAt,
            status === "active" ? null : ownershipToken,
            dnsTargets
          ),
          updated_at: completedAt,
        },
        { merge: true }
      );
    });

    return res.status(200).json({
      ok: true,
      host,
      status,
      verification: vercelDomain.verification || [],
      dnsTargets,
      ...(status === "pending"
        ? { ownershipRecord: domainOwnershipRecord(host, ownershipToken) }
        : {}),
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
      });
    }

    console.error("[sitebuilder/domains/add] failed:", error);
    return res.status(500).json({ ok: false, error: "ADD_FAILED" });
  }
}
