// lib/token.ts
import { randomBytes } from "crypto";

export function generateToken(): string {
  // URL-safe base64 token
  return randomBytes(24).toString("base64url");
}

export function minutesFromNow(mins: number): number {
  return Date.now() + mins * 60 * 1000;
}
