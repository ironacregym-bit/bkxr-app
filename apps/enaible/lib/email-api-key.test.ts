import { describe, expect, it } from "vitest";
import {
  createEmailApiKey,
  matchesEmailApiSecret,
  parseEmailApiKey,
} from "./email-api-key";

describe("tenant-scoped email API keys", () => {
  it("encodes the lookup tenant and verifies only the stored secret hash", () => {
    const generated = createEmailApiKey("tenant-1");
    const parsed = parseEmailApiKey(generated.token);

    expect(parsed?.tenantId).toBe("tenant-1");
    expect(parsed?.keyId).toBe(generated.keyId);
    expect(matchesEmailApiSecret(parsed?.secret || "", generated.secretHash)).toBe(
      true
    );
    expect(
      matchesEmailApiSecret("different-secret", generated.secretHash)
    ).toBe(false);
  });

  it("rejects malformed, tampered, and non-canonical tokens", () => {
    const generated = createEmailApiKey("tenant-1");

    expect(parseEmailApiKey(`${generated.token}x`)).toBeNull();
    expect(parseEmailApiKey("tenant-1")).toBeNull();
    expect(matchesEmailApiSecret("secret", "bad-hash")).toBe(false);
  });
});
