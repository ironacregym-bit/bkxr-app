import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addVercelProjectDomain,
  getVercelDomainDnsTargets,
  VercelDomainError,
  verifyVercelProjectDomain,
} from "./vercel-domains";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Vercel domain provisioning", () => {
  it("adds a domain using the server-side project token", async () => {
    vi.stubEnv("VERCEL_ACCESS_TOKEN", "server-token");
    vi.stubEnv("VERCEL_PROJECT_ID", "project-id");
    vi.stubEnv("VERCEL_TEAM_ID", "team-id");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "example.com",
          verified: false,
          verification: [
            {
              domain: "_vercel.example.com",
              type: "TXT",
              value: "vercel-domain-verification=token",
            },
          ],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(addVercelProjectDomain("example.com")).resolves.toMatchObject({
      name: "example.com",
      verified: false,
      verification: [
        {
          domain: "_vercel.example.com",
          type: "TXT",
          value: "vercel-domain-verification=token",
        },
      ],
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.vercel.com/v10/projects/project-id/domains?teamId=team-id"
    );
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer server-token"
    );
    expect(JSON.parse(String(init.body))).toEqual({ name: "example.com" });
  });

  it("fails explicitly when provisioning credentials are not configured", async () => {
    vi.stubEnv("VERCEL_ACCESS_TOKEN", "");
    vi.stubEnv("VERCEL_TOKEN", "");
    vi.stubEnv("VERCEL_PROJECT_ID", "");
    await expect(addVercelProjectDomain("example.com")).rejects.toBeInstanceOf(
      VercelDomainError
    );
  });

  it("checks verification through the project-domain endpoint", async () => {
    vi.stubEnv("VERCEL_TOKEN", "server-token");
    vi.stubEnv("VERCEL_PROJECT_ID", "project-id");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ name: "example.com", verified: true }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      verifyVercelProjectDomain("example.com")
    ).resolves.toMatchObject({
      name: "example.com",
      verified: true,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.vercel.com/v9/projects/project-id/domains/example.com/verify"
    );
  });

  it("loads the Vercel-recommended DNS targets for the project domain", async () => {
    vi.stubEnv("VERCEL_TOKEN", "server-token");
    vi.stubEnv("VERCEL_PROJECT_ID", "project-id");
    vi.stubEnv("VERCEL_TEAM_ID", "team-id");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          recommendedCNAME: [
            { rank: 1, value: "cname.vercel-dns.com" },
          ],
          recommendedIPv4: [{ rank: 1, value: ["76.76.21.21"] }],
          misconfigured: true,
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getVercelDomainDnsTargets("example.com")
    ).resolves.toEqual([
      { type: "CNAME", rank: 1, value: "cname.vercel-dns.com" },
      { type: "A", rank: 1, value: "76.76.21.21" },
    ]);

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.pathname).toBe("/v6/domains/example.com/config");
    expect(requestUrl.searchParams.get("projectIdOrName")).toBe("project-id");
    expect(requestUrl.searchParams.get("teamId")).toBe("team-id");
  });
});
