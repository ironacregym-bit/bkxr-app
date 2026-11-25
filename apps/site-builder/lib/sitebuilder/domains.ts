import { z } from "zod";

export const domainRequestSchema = z.object({
  siteId: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
  host: z.string().trim().min(1).max(253),
});

export function normalizeCustomDomain(value: string) {
  const input = value.trim();
  if (!input || input.length > 253) return null;

  let hostname = input;
  try {
    const url = new URL(input.includes("://") ? input : `https://${input}`);
    if (
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    hostname = url.hostname;
  } catch {
    return null;
  }

  hostname = hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname.length > 227 || !hostname.includes(".")) {
    return null;
  }
  if (/^\d+(?:\.\d+){3}$/.test(hostname)) return null;

  const labels = hostname.split(".");
  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    )
  ) {
    return null;
  }

  return hostname;
}

export type DomainVerificationChallenge = {
  domain: string;
  type: string;
  value: string;
};

export function readDomainVerification(
  value: unknown
): DomainVerificationChallenge[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (challenge): challenge is DomainVerificationChallenge =>
      Boolean(
        challenge &&
          typeof challenge === "object" &&
          typeof challenge.domain === "string" &&
          typeof challenge.type === "string" &&
          typeof challenge.value === "string"
      )
  );
}

export type DomainDnsTarget = {
  type: "A" | "CNAME";
  value: string;
  rank: number;
};

export function readDomainDnsTargets(value: unknown): DomainDnsTarget[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (target): target is DomainDnsTarget =>
      Boolean(
        target &&
          typeof target === "object" &&
          (target.type === "A" || target.type === "CNAME") &&
          typeof target.value === "string" &&
          typeof target.rank === "number"
      )
  );
}

export type VercelProjectDomain = {
  name: string;
  verified: boolean;
  verification?: DomainVerificationChallenge[];
};

export type SiteDomainRecord = Record<string, unknown> & {
  host?: unknown;
  addedAt?: unknown;
  ownershipToken?: unknown;
};

function isRecord(value: unknown): value is SiteDomainRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function findSiteDomain(currentDomains: unknown, host: string) {
  if (!Array.isArray(currentDomains)) return undefined;
  return currentDomains.find(
    (domain): domain is SiteDomainRecord =>
      isRecord(domain) &&
      normalizeCustomDomain(String(domain.host || "")) === host
  );
}

export function upsertSiteDomain(
  currentDomains: unknown,
  host: string,
  status: "pending" | "active",
  verification: DomainVerificationChallenge[],
  now: string,
  ownershipToken?: string | null,
  dnsTargets?: DomainDnsTarget[]
) {
  const domains = Array.isArray(currentDomains)
    ? currentDomains.filter(isRecord)
    : [];
  const index = domains.findIndex(
    (domain) => normalizeCustomDomain(String(domain.host || "")) === host
  );
  const previous = index >= 0 ? domains[index] : {};
  const safePrevious = Object.fromEntries(
    Object.entries(previous).filter(
      ([key]) =>
        key !== "verificationToken" &&
        !(key === "ownershipToken" && ownershipToken === null)
    )
  );
  const next = {
    ...safePrevious,
    host,
    status,
    verification,
    addedAt: previous.addedAt || now,
    ...(typeof ownershipToken === "string" ? { ownershipToken } : {}),
    ...(dnsTargets ? { dnsTargets } : {}),
    ...(status === "active" ? { verifiedAt: now } : {}),
  };

  if (index >= 0) domains[index] = next;
  else domains.push(next);
  return domains;
}
