import { describe, expect, it } from "vitest";
import {
  domainRequestSchema,
  normalizeCustomDomain,
  upsertSiteDomain,
} from "./domains";

describe("domainRequestSchema", () => {
  it("accepts site IDs and domains in the expected shape", () => {
    expect(
      domainRequestSchema.safeParse({
        siteId: "site_123-abc",
        host: "example.com",
      }).success
    ).toBe(true);
  });

  it("rejects Firestore path separators in site IDs", () => {
    expect(
      domainRequestSchema.safeParse({
        siteId: "tenant/site",
        host: "example.com",
      }).success
    ).toBe(false);
  });
});

describe("normalizeCustomDomain", () => {
  it("normalizes a hostname or HTTPS URL", () => {
    expect(normalizeCustomDomain("WWW.Example.com")).toBe("www.example.com");
    expect(normalizeCustomDomain("https://Example.com/")).toBe("example.com");
  });

  it("rejects URLs with paths, ports, IPs, and malformed labels", () => {
    expect(normalizeCustomDomain("https://example.com/path")).toBeNull();
    expect(normalizeCustomDomain("example.com:3000")).toBeNull();
    expect(normalizeCustomDomain("192.0.2.1")).toBeNull();
    expect(normalizeCustomDomain("-bad.example.com")).toBeNull();
    expect(normalizeCustomDomain(`${"a".repeat(220)}.example.com`)).toBeNull();
  });
});

describe("upsertSiteDomain", () => {
  it("stores an ownership challenge while pending and removes it when active", () => {
    expect(
      upsertSiteDomain([], "example.com", "pending", [], "2026-01-01", "token")
    ).toEqual([
      {
        host: "example.com",
        status: "pending",
        verification: [],
        addedAt: "2026-01-01",
        ownershipToken: "token",
      },
    ]);

    const domains = upsertSiteDomain(
      [
        {
          host: "example.com",
          status: "verified",
          verificationToken: "legacy-secret",
          ownershipToken: "pending-token",
          addedAt: "2026-01-01",
        },
      ],
      "example.com",
      "active",
      [],
      "2026-02-01",
      null
    );

    expect(domains).toEqual([
      {
        host: "example.com",
        status: "active",
        verification: [],
        addedAt: "2026-01-01",
        verifiedAt: "2026-02-01",
      },
    ]);
  });
});
