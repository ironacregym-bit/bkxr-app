
// lib/time.ts
export function toMillis(input: any): number | null {
  if (!input) return null;

  // Firestore Timestamp object
  if (typeof input === "object" && input.seconds != null && input.nanoseconds != null) {
    // Officially: input.toMillis()
    if (typeof input.toMillis === "function") return input.toMillis();
    return input.seconds * 1000 + Math.floor(input.nanoseconds / 1e6);
  }

  // Firestore server Timestamp sometimes serialized as { _seconds, _nanoseconds }
  if (typeof input === "object" && input._seconds != null && input._nanoseconds != null) {
    return input._seconds * 1000 + Math.floor(input._nanoseconds / 1e6);
  }

  // Plain numbers: detect seconds vs milliseconds
  if (typeof input === "number") {
    // If it looks like seconds (<= 10^10), convert to ms
    if (input < 1e11) return input * 1000;
    // Otherwise assume ms already
    return input;
  }

  // ISO string
  if (typeof input === "string") {
    const t = Date.parse(input);
    return Number.isFinite(t) ? t : null;
  }

  return null;
}
