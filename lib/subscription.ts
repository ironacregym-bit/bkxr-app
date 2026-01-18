
// lib/subscription.ts
export type SubStatus =
  | "active"
  | "trialing"
  | "trial_ended"
  | "paused"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "none"
  | string;

export function parseTs(v: any): Date | null {
  if (!v) return null;
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (v?.toDate) {
    try { return v.toDate() as Date; } catch { return null; }
  }
  if (typeof v?.seconds === "number") {
    return new Date(v.seconds * 1000 + Math.floor((v.nanoseconds ?? 0) / 1e6));
  }
  return null;
}

export function daysDiff(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

export function daysLeft(user: any, now = new Date()): number | null {
  const end = parseTs(user?.trial_end);
  if (!end) return null;
  return Math.max(0, daysDiff(end, now));
}

export function isMemberActive(user: any, now = new Date()): boolean {
  const status = (user?.subscription_status || "none") as SubStatus;

  if (status === "active") return true;

  if (status === "trialing") {
    const end = parseTs(user?.trial_end);
    return !!(end && now < end);
  }

  // Optional grace period support
  const graceUntil = parseTs(user?.grace_until);
  if (graceUntil && now < graceUntil) return true;

  // Gym membership overrides (if you want to keep this):
  if (user?.membership_status === "gym_member" && user?.membership_verified) return true;

  return false;
}
