import { describe, expect, it } from "vitest";
import { resolveSiteBuilderRedirectUrl } from "./auth-redirect";

describe("resolveSiteBuilderRedirectUrl", () => {
  const siteBuilderUrl = "https://builder.example.com";

  it("keeps relative callback paths on the SiteBuilder origin", () => {
    expect(
      resolveSiteBuilderRedirectUrl("/sitebuilder?view=sites", siteBuilderUrl)
    ).toBe("https://builder.example.com/sitebuilder?view=sites");
  });

  it("rejects redirects to the Iron Acre Gym origin", () => {
    expect(
      resolveSiteBuilderRedirectUrl(
        "https://ironacregym.co.uk/register",
        siteBuilderUrl
      )
    ).toBe(siteBuilderUrl);
  });

  it("preserves absolute URLs on the SiteBuilder origin", () => {
    expect(
      resolveSiteBuilderRedirectUrl(
        "https://builder.example.com/sitebuilder",
        siteBuilderUrl
      )
    ).toBe("https://builder.example.com/sitebuilder");
  });
});
