import { describe, expect, it } from "vitest";
import {
  getSiteBuilderOrigin,
  resolveSiteBuilderRedirectUrl,
  SITEBUILDER_PRODUCTION_URL,
} from "./auth-redirect";

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
    ).toBe("https://builder.example.com/sitebuilder");
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

describe("getSiteBuilderOrigin", () => {
  it("prefers the configured SiteBuilder domain over a deployment URL", () => {
    expect(
      getSiteBuilderOrigin({
        siteBuilderUrl: "https://site-builder-two-pi.vercel.app",
        deploymentUrl: "site-builder-git-main-abc.vercel.app",
        isPreview: true,
      })
    ).toBe("https://site-builder-two-pi.vercel.app");
  });

  it("uses the SiteBuilder deployment URL for preview builds", () => {
    expect(
      getSiteBuilderOrigin({
        deploymentUrl: "site-builder-git-branch-abc.vercel.app",
        isPreview: true,
      })
    ).toBe("https://site-builder-git-branch-abc.vercel.app");
  });

  it("never falls back to the gym app's NEXTAUTH_URL in production", () => {
    expect(getSiteBuilderOrigin({})).toBe(SITEBUILDER_PRODUCTION_URL);
  });
});
