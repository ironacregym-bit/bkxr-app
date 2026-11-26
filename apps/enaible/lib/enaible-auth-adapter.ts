import type {
  Adapter,
  AdapterAccount,
  AdapterUser,
} from "next-auth/adapters";
import { adminDb } from "@pt/firebase/admin";
import {
  enaibleAccountDocumentId,
  serializeEnaibleAccount,
} from "./auth-adapter-utils";
import {
  ENAIBLE_ACCOUNTS_COLLECTION,
  ENAIBLE_USERS_COLLECTION,
} from "./auth-collections";

type UserDocument = Record<string, unknown>;

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();
    return date instanceof Date ? date : null;
  }
  return null;
}

function toAdapterUser(
  id: string,
  document: UserDocument
): AdapterUser | null {
  if (typeof document.email !== "string") return null;

  return {
    id,
    email: document.email,
    emailVerified: toDate(document.emailVerified),
    name:
      typeof document.name === "string"
        ? document.name
        : typeof document.displayName === "string"
          ? document.displayName
          : null,
    image: typeof document.image === "string" ? document.image : null,
  };
}

async function getUserById(id: string): Promise<AdapterUser | null> {
  const snapshot = await adminDb
    .collection(ENAIBLE_USERS_COLLECTION)
    .doc(id)
    .get();
  return snapshot.exists
    ? toAdapterUser(id, snapshot.data() ?? {})
    : null;
}

async function getUserByEmail(email: string): Promise<AdapterUser | null> {
  const currentUsers = await adminDb
    .collection(ENAIBLE_USERS_COLLECTION)
    .where("email", "==", email)
    .limit(1)
    .get();
  const currentUser = currentUsers.docs[0];
  if (currentUser) {
    return toAdapterUser(currentUser.id, currentUser.data());
  }

  const legacyUsers = await adminDb
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();
  const legacyUser = legacyUsers.docs[0];
  if (!legacyUser) return null;

  const legacyData = legacyUser.data();
  const userId = legacyUser.id;
  const userRef = adminDb.collection(ENAIBLE_USERS_COLLECTION).doc(userId);
  const now = new Date().toISOString();

  await adminDb.runTransaction(async (transaction) => {
    const existing = await transaction.get(userRef);
    if (existing.exists) return;

    transaction.create(userRef, {
      userId,
      email,
      emailVerified: null,
      name:
        typeof legacyData.name === "string"
          ? legacyData.name
          : typeof legacyData.displayName === "string"
            ? legacyData.displayName
            : null,
      image: null,
      createdAt:
        typeof legacyData.createdAt === "string"
          ? legacyData.createdAt
          : now,
      updatedAt: now,
      migratedFromLegacy: true,
    });
  });

  return getUserById(userId);
}

export function createEnaibleAuthAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, "id">) {
      const userRef = adminDb.collection(ENAIBLE_USERS_COLLECTION).doc();
      const now = new Date().toISOString();

      await userRef.create({
        userId: userRef.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name ?? null,
        image: user.image ?? null,
        createdAt: now,
        updatedAt: now,
      });

      return { ...user, id: userRef.id };
    },

    getUser: getUserById,

    getUserByEmail,

    async getUserByAccount({ provider, providerAccountId }) {
      const account = await adminDb
        .collection(ENAIBLE_ACCOUNTS_COLLECTION)
        .doc(enaibleAccountDocumentId(provider, providerAccountId))
        .get();
      const userId = account.data()?.userId;
      return typeof userId === "string" ? getUserById(userId) : null;
    },

    async updateUser(user) {
      const { id, ...userFields } = user;
      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      for (const field of [
        "email",
        "emailVerified",
        "name",
        "image",
      ] as const) {
        if (userFields[field] !== undefined) {
          updates[field] = userFields[field];
        }
      }

      const userRef = adminDb.collection(ENAIBLE_USERS_COLLECTION).doc(id);
      await userRef.set(updates, { merge: true });

      const updatedUser = await userRef.get();
      const parsed = toAdapterUser(id, updatedUser.data() ?? {});
      if (!parsed) throw new Error("[EnAIble auth] Updated user has no email");
      return parsed;
    },

    async linkAccount(account: AdapterAccount) {
      const accountRef = adminDb
        .collection(ENAIBLE_ACCOUNTS_COLLECTION)
        .doc(
          enaibleAccountDocumentId(
            account.provider,
            account.providerAccountId
          )
        );
      await accountRef.create({
        ...serializeEnaibleAccount(account),
        createdAt: new Date().toISOString(),
      });
    },
  };
}
