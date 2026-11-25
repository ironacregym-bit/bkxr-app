import { createHash, randomBytes, timingSafeEqual } from "crypto";

export type ParsedEmailApiKey = {
  tenantId: string;
  keyId: string;
  secret: string;
};

export function createEmailApiKey(tenantId: string) {
  const keyId = randomBytes(9).toString("hex");
  const secret = randomBytes(32).toString("base64url");
  const encodedTenantId = Buffer.from(tenantId, "utf8").toString("base64url");

  return {
    keyId,
    token: `eak_${encodedTenantId}.${keyId}.${secret}`,
    secretHash: createHash("sha256").update(secret).digest("hex"),
  };
}

export function parseEmailApiKey(token: string): ParsedEmailApiKey | null {
  const match = /^eak_([A-Za-z0-9_-]+)\.([a-f0-9]{18})\.([A-Za-z0-9_-]{43})$/.exec(
    token
  );
  if (!match) return null;

  const encodedTenantId = match[1];
  const tenantId = Buffer.from(encodedTenantId, "base64url").toString("utf8");
  if (
    !tenantId ||
    Buffer.from(tenantId, "utf8").toString("base64url") !== encodedTenantId
  ) {
    return null;
  }

  return {
    tenantId,
    keyId: match[2],
    secret: match[3],
  };
}

export function matchesEmailApiSecret(secret: string, storedHash: string) {
  if (!/^[a-f0-9]{64}$/.test(storedHash)) return false;
  const suppliedHash = createHash("sha256").update(secret).digest();
  const expectedHash = Buffer.from(storedHash, "hex");
  return (
    expectedHash.length === suppliedHash.length &&
    timingSafeEqual(expectedHash, suppliedHash)
  );
}
