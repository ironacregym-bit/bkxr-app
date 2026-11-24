import { createHmac, timingSafeEqual } from "crypto";

function signatureFor(
  userId: string,
  tenantId: string,
  secret: string
) {
  return createHmac("sha256", secret)
    .update(`${userId}:${tenantId}`)
    .digest("hex");
}

export function signTenantCookie(
  userId: string,
  tenantId: string,
  secret: string
) {
  return `${tenantId}.${signatureFor(userId, tenantId, secret)}`;
}

export function verifyTenantCookie(
  value: string,
  userId: string,
  secret: string
): string | null {
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;

  const tenantId = value.slice(0, separator);
  const suppliedSignature = value.slice(separator + 1);
  const expectedSignature = signatureFor(
    userId,
    tenantId,
    secret
  );
  const supplied = Buffer.from(suppliedSignature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");

  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return null;
  }

  return tenantId;
}
