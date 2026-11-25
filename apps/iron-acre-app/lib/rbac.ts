// lib/rbac.ts
export type UserRole = "user" | "gym" | "admin";

export function hasRole(session: any, allowed: UserRole[]): boolean {
  if (!session || !session.user || !session.user.role) return false;
  return allowed.includes(session.user.role as UserRole);
}

export function isGymOwner(session: any, gymId: string | undefined): boolean {
  if (!session || !session.user) return false;
  // If your session carries gym_id, require match
  if (session.user.role === "admin") return true;
  if (session.user.role === "gym" && session.user.gym_id && gymId) {
    return session.user.gym_id === gymId;
  }
  return false;
}
