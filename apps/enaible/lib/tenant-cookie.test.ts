import { describe, expect, it } from "vitest";
import {
  signTenantCookie,
  verifyTenantCookie,
} from "./tenant-cookie";

const secret = "test-secret-with-more-than-thirty-two-characters";

describe("active tenant cookie", () => {
  it("verifies the tenant only for the user who signed it", () => {
    const value = signTenantCookie("user-1", "tenant-1", secret);

    expect(verifyTenantCookie(value, "user-1", secret)).toBe("tenant-1");
    expect(verifyTenantCookie(value, "user-2", secret)).toBeNull();
  });

  it("rejects tampered values and a different secret", () => {
    const value = signTenantCookie("user-1", "tenant-1", secret);

    expect(
      verifyTenantCookie(`${value}tampered`, "user-1", secret)
    ).toBeNull();
    expect(
      verifyTenantCookie(value, "user-1", `${secret}-different`)
    ).toBeNull();
    expect(verifyTenantCookie("not-a-signed-cookie", "user-1", secret)).toBeNull();
  });
});
