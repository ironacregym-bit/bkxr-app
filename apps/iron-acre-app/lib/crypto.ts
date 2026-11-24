
// lib/crypto.ts
import crypto from "crypto";

const alg = "aes-256-gcm";

// ENCRYPTION_KEY: 32 bytes (Base64) -> Buffer(32)
function getKey(): Buffer {
  const b64 = process.env.ENCRYPTION_KEY || "";
  const buf = Buffer.from(b64, "base64");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (base64).");
  return buf;
}

export function encryptJson(obj: unknown): string {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv(alg, key, iv);
  const json = Buffer.from(JSON.stringify(obj), "utf8");
  const enc = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptJson<T = any>(b64: string): T {
  const raw = Buffer.from(b64, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const key = getKey();
  const decipher = crypto.createDecipheriv(alg, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(dec.toString("utf8"));
}
