import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  resolveTxt: vi.fn(),
}));

import { resolveTxt } from "node:dns/promises";
import {
  createDomainOwnershipToken,
  domainOwnershipRecord,
  hasDomainOwnershipRecord,
} from "./domain-ownership";

afterEach(() => {
  vi.mocked(resolveTxt).mockReset();
});

describe("SiteBuilder domain ownership challenges", () => {
  it("creates a random token and a dedicated TXT record", () => {
    const token = createDomainOwnershipToken();

    expect(token).toMatch(/^[a-f0-9]{48}$/);
    expect(domainOwnershipRecord("example.com", token)).toEqual({
      domain: "_sitebuilder-verification.example.com",
      type: "TXT",
      value: token,
    });
  });

  it("matches TXT values split across DNS chunks", async () => {
    vi.mocked(resolveTxt).mockResolvedValue([["sitebuilder-", "proof"]]);

    await expect(
      hasDomainOwnershipRecord("example.com", "sitebuilder-proof")
    ).resolves.toBe(true);
    expect(resolveTxt).toHaveBeenCalledWith(
      "_sitebuilder-verification.example.com"
    );
  });

  it("reports a missing DNS record as unverified", async () => {
    vi.mocked(resolveTxt).mockRejectedValue(
      Object.assign(new Error("record not found"), { code: "ENODATA" })
    );

    await expect(
      hasDomainOwnershipRecord("example.com", "sitebuilder-proof")
    ).resolves.toBe(false);
  });
});
