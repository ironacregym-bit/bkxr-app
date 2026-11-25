import {
  normalizeCustomDomain,
  type DomainDnsTarget,
  type DomainVerificationChallenge,
  type VercelProjectDomain,
} from "./domains";

type VercelDomainConfig = {
  accessToken: string;
  projectId: string;
  teamId?: string;
};

export class VercelDomainError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly verification?: DomainVerificationChallenge[]
  ) {
    super(message);
    this.name = "VercelDomainError";
  }
}

type VercelDomainDnsConfig = {
  recommendedCNAME?: Array<{ rank?: number; value?: string }>;
  recommendedIPv4?: Array<{ rank?: number; value?: string[] }>;
  misconfigured?: boolean;
};

function getVercelDomainConfig(): VercelDomainConfig {
  const accessToken =
    process.env.VERCEL_ACCESS_TOKEN || process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!accessToken || !projectId) {
    throw new VercelDomainError(
      "Vercel domain provisioning is not configured.",
      503
    );
  }

  return {
    accessToken,
    projectId,
    teamId: process.env.VERCEL_TEAM_ID || undefined,
  };
}

export function isVercelDomainProvisioningConfigured() {
  return Boolean(
    (process.env.VERCEL_ACCESS_TOKEN || process.env.VERCEL_TOKEN) &&
      process.env.VERCEL_PROJECT_ID
  );
}

function getApiUrl(config: VercelDomainConfig, path: string) {
  const url = new URL(`https://api.vercel.com${path}`);
  if (config.teamId) url.searchParams.set("teamId", config.teamId);
  return url;
}

async function readJson<T extends object>(response: Response) {
  return response.json().catch(() => ({})) as Promise<
    T & { error?: { message?: string } }
  >;
}

function verificationFrom(
  value: Partial<VercelProjectDomain>
): DomainVerificationChallenge[] {
  if (!Array.isArray(value.verification)) return [];
  return value.verification.filter(
    (challenge): challenge is DomainVerificationChallenge =>
      Boolean(
        challenge &&
          typeof challenge.domain === "string" &&
          typeof challenge.type === "string" &&
          typeof challenge.value === "string"
      )
  );
}

async function requestProjectDomain(
  config: VercelDomainConfig,
  path: string,
  init: RequestInit
) {
  return fetch(getApiUrl(config, path), {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

function projectDomainPath(projectId: string, host: string, version: string) {
  return `/${version}/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(host)}`;
}

export async function addVercelProjectDomain(
  host: string
): Promise<VercelProjectDomain> {
  const config = getVercelDomainConfig();
  const projectPath = `/v10/projects/${encodeURIComponent(config.projectId)}/domains`;
  const response = await requestProjectDomain(config, projectPath, {
    method: "POST",
    body: JSON.stringify({ name: host }),
  });

  let result = await readJson<Partial<VercelProjectDomain>>(response);
  if (!response.ok && (response.status === 400 || response.status === 409)) {
    const existing = await requestProjectDomain(
      config,
      projectDomainPath(config.projectId, host, "v9"),
      { method: "GET" }
    );
    if (existing.ok) {
      result = await readJson<Partial<VercelProjectDomain>>(existing);
    } else {
      throw new VercelDomainError(
        result.error?.message || "Vercel could not attach this domain.",
        response.status,
        verificationFrom(result)
      );
    }
  } else if (!response.ok) {
    throw new VercelDomainError(
      result.error?.message || "Vercel could not attach this domain.",
      response.status,
      verificationFrom(result)
    );
  }

  if (typeof result.name !== "string" || typeof result.verified !== "boolean") {
    throw new VercelDomainError(
      "Vercel returned an invalid domain response.",
      502
    );
  }

  return {
    name: result.name,
    verified: result.verified,
    verification: verificationFrom(result),
  };
}

export async function verifyVercelProjectDomain(
  host: string
): Promise<VercelProjectDomain> {
  const config = getVercelDomainConfig();
  const response = await requestProjectDomain(
    config,
    projectDomainPath(config.projectId, host, "v9") + "/verify",
    { method: "POST" }
  );
  const result = await readJson<Partial<VercelProjectDomain>>(response);

  if (!response.ok) {
    throw new VercelDomainError(
      result.error?.message || "Vercel has not verified the domain yet.",
      response.status,
      verificationFrom(result)
    );
  }

  if (typeof result.name !== "string" || typeof result.verified !== "boolean") {
    throw new VercelDomainError(
      "Vercel returned an invalid verification response.",
      502
    );
  }
  if (normalizeCustomDomain(result.name) !== host) {
    throw new VercelDomainError(
      "Vercel returned a different domain than requested.",
      502
    );
  }

  return {
    name: result.name,
    verified: result.verified,
    verification: verificationFrom(result),
  };
}

export async function getVercelDomainDnsTargets(
  host: string
): Promise<DomainDnsTarget[]> {
  const config = getVercelDomainConfig();
  const url = getApiUrl(
    config,
    `/v6/domains/${encodeURIComponent(host)}/config`
  );
  url.searchParams.set("projectIdOrName", config.projectId);
  const response = await requestProjectDomain(
    config,
    url.pathname + url.search,
    { method: "GET" }
  );
  const result = await readJson<Partial<VercelDomainDnsConfig>>(response);

  if (!response.ok) {
    throw new VercelDomainError(
      result.error?.message || "Vercel could not load DNS targets.",
      response.status
    );
  }
  const recommendedCNAME = result.recommendedCNAME;
  const recommendedIPv4 = result.recommendedIPv4;
  if (
    !Array.isArray(recommendedCNAME) ||
    !Array.isArray(recommendedIPv4) ||
    typeof result.misconfigured !== "boolean"
  ) {
    throw new VercelDomainError(
      "Vercel returned an invalid DNS configuration.",
      502
    );
  }

  const targets: DomainDnsTarget[] = [];
  recommendedCNAME.forEach((record) => {
    if (
      record &&
      typeof record === "object" &&
      typeof record.rank === "number" &&
      typeof record.value === "string"
    ) {
      targets.push({ type: "CNAME", rank: record.rank, value: record.value });
    }
  });
  recommendedIPv4.forEach((record) => {
    if (
      !record ||
      typeof record !== "object" ||
      typeof record.rank !== "number" ||
      !Array.isArray(record.value)
    ) {
      return;
    }
    const rank = record.rank;
    record.value.forEach((value) => {
      if (typeof value === "string") {
        targets.push({ type: "A", rank, value });
      }
    });
  });

  return targets.sort((left, right) => left.rank - right.rank);
}
