
import { createHash } from "crypto";

export function generateReferralCode(uid: string) {
  return createHash("sha256").update(uid).digest("base64url").slice(0, 6);
}
