import { describe, expect, it } from "vitest";
import type { AdapterAccount } from "next-auth/adapters";
import {
  enaibleAccountDocumentId,
  serializeEnaibleAccount,
} from "./auth-adapter-utils";

describe("EnAIble NextAuth Firestore adapter", () => {
  it("stores only the provider identity needed to resolve sign-ins", () => {
    const account: AdapterAccount = {
      userId: "user-1",
      provider: "google",
      providerAccountId: "google-user-1",
      type: "oauth",
      access_token: "do-not-store",
      refresh_token: "do-not-store",
      id_token: "do-not-store",
    };

    expect(serializeEnaibleAccount(account)).toEqual({
      userId: "user-1",
      provider: "google",
      providerAccountId: "google-user-1",
      type: "oauth",
    });
  });

  it("uses a stable Firestore document ID for a provider account", () => {
    const id = enaibleAccountDocumentId("google", "google-user-1");

    expect(id).toMatch(/^[a-f0-9]{64}$/);
    expect(enaibleAccountDocumentId("google", "google-user-1")).toBe(id);
    expect(enaibleAccountDocumentId("google", "google-user-2")).not.toBe(id);
  });
});
