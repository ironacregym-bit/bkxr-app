export const ENAIBLE_USERS_COLLECTION = "enaible_users";

export type EnaibleAuthIdentity = {
  uid: string;
  email?: string;
  name?: string;
};

export function buildEnaibleUserProfile(
  identity: EnaibleAuthIdentity,
  now: string,
  createdAt = now
) {
  return {
    userId: identity.uid,
    email: identity.email ?? null,
    displayName: identity.name ?? null,
    createdAt,
    updatedAt: now,
  };
}
