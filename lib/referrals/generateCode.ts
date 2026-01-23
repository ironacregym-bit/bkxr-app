
// lib/referrals/generateCode.ts
import { randomBytes } from "crypto";
import firestore from "../firestoreClient";

/**
 * 6-char Base64URL string, regenerated on collision.
 * Extremely low collision rate; we still check Firestore once.
 */
function shortCode(len = 6) {
  return randomBytes(6).toString("base64url").slice(0, len);
}

/**
 * Generate a referral code not already used by any user.
 * Tries up to 5 times; increases length if somehow colliding repeatedly.
 */
export async function generateUniqueReferralCode(): Promise<string> {
  let len = 6;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = shortCode(len);
    const snap = await firestore
      .collection("users")
      .where("referral_code", "==", code)
      .limit(1)
      .get();
    if (snap.empty) return code;
    // ultra-rare: expand code length and retry
    len++;
  }
  // fallback (very unlikely to reach)
  return shortCode(8);
}
