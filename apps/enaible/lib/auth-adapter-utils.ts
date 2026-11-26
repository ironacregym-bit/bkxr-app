import { createHash } from "node:crypto";
import type { AdapterAccount } from "next-auth/adapters";

export function enaibleAccountDocumentId(
  provider: string,
  providerAccountId: string
) {
  return createHash("sha256")
    .update(`${provider}:${providerAccountId}`)
    .digest("hex");
}

export function serializeEnaibleAccount(account: AdapterAccount) {
  return {
    userId: account.userId,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    type: account.type,
  };
}
