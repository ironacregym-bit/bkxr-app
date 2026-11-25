import { getServerSession } from "next-auth";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { firestore } from "@pt/firebase";
import { canEditSite } from "@/lib/sitebuilder/access";
import {
  normalizeCustomDomain,
  readDomainDnsTargets,
  readDomainVerification,
  type DomainDnsTarget,
  type DomainVerificationChallenge,
} from "@/lib/sitebuilder/domains";
import { domainOwnershipRecord } from "@/lib/sitebuilder/domain-ownership";

type Resp =
  | {
      ok: true;
      domains: Array<{
        host: string;
        status: string;
        dnsTargets: DomainDnsTarget[];
        verification: DomainVerificationChallenge[];
        ownershipRecord?: DomainVerificationChallenge;
        addedAt?: string;
        verifiedAt?: string;
      }>;
    }
  | { ok: false; error: string };

const querySchema = z.object({
  siteId: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
});

function stringOrUndefined(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const parsed = querySchema.safeParse({
    siteId: Array.isArray(req.query.siteId)
      ? req.query.siteId[0]
      : req.query.siteId,
  });
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "INVALID_INPUT" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email?.trim().toLowerCase() || "";
  if (!email) {
    return res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });
  }

  try {
    const snapshot = await firestore
      .collection("sitebuilder_sites")
      .doc(parsed.data.siteId)
      .get();
    if (!snapshot.exists) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    const site = snapshot.data() || {};
    if (!canEditSite(site, email)) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const domains = Array.isArray(site.domains) ? site.domains : [];
    return res.status(200).json({
      ok: true,
      domains: domains
        .filter(
          (domain): domain is Record<string, unknown> =>
            Boolean(domain && typeof domain === "object")
        )
        .map((domain) => {
          const host = String(domain.host || "");
          const normalizedHost = normalizeCustomDomain(host);
          const ownershipRecord =
            domain.status !== "active" &&
            typeof domain.ownershipToken === "string" &&
            normalizedHost
              ? domainOwnershipRecord(
                  normalizedHost,
                  domain.ownershipToken
                )
              : undefined;

          return {
            host,
            status: String(domain.status || "pending"),
            dnsTargets: readDomainDnsTargets(domain.dnsTargets),
            verification: readDomainVerification(domain.verification),
            ...(ownershipRecord ? { ownershipRecord } : {}),
            addedAt: stringOrUndefined(domain.addedAt),
            verifiedAt: stringOrUndefined(domain.verifiedAt),
          };
        }),
    });
  } catch (error) {
    console.error("[sitebuilder/domains/list] failed:", error);
    return res.status(500).json({ ok: false, error: "LIST_FAILED" });
  }
}
