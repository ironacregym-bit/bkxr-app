import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import type { DomainVerificationChallenge } from "./domains";

const OWNERSHIP_RECORD_PREFIX = "_sitebuilder-verification";

function ownershipRecordName(host: string) {
  return `${OWNERSHIP_RECORD_PREFIX}.${host}`;
}

export function createDomainOwnershipToken() {
  return randomBytes(24).toString("hex");
}

export function domainOwnershipRecord(
  host: string,
  token: string
): DomainVerificationChallenge {
  return {
    domain: ownershipRecordName(host),
    type: "TXT",
    value: token,
  };
}

function dnsErrorCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return "";
}

export async function hasDomainOwnershipRecord(
  host: string,
  token: string
) {
  let records: string[][];
  try {
    records = await resolveTxt(ownershipRecordName(host));
  } catch (error) {
    const code = dnsErrorCode(error);
    if (code === "ENODATA" || code === "ENOTFOUND") return false;
    throw error;
  }

  return records.some((record) => record.join("") === token);
}
