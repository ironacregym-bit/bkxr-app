// File: middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * SiteBuilder custom domain routing - phase 1
 *
 * This is a manual host-to-slug mapping approach.
 *
 * Add this in Vercel env:
 *
 * SITEBUILDER_BASE_HOST=ironacregym.co.uk
 * SITEBUILDER_BASE_HOSTS=ironacregym.co.uk,www.ironacregym.co.uk
 *
 * SITEBUILDER_HOSTS_JSON='{
 *   "clientdomain.co.uk": "client-slug",
 *   "www.clientdomain.co.uk": "client-slug"
 * }'
 *
 * The mapped value must be the public SiteBuilder slug used by /p/[slug].
 *
 * This middleware does not read Firestore because Middleware runs before the
 * page route is served and should stay lightweight. Later we can move this
 * mapping to Edge Config, KV, or a Vercel Domain API automation flow.
 */

function normalizeHost(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .split(":")[0];
}

function normalizePath(value: string) {
  const path = String(value || "").trim();
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function parseHostMap() {
  try {
    const raw = process.env.SITEBUILDER_HOSTS_JSON || "{}";
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const map: Record<string, string> = {};

    Object.entries(parsed).forEach(([host, slug]) => {
      const cleanHost = normalizeHost(host);
      const cleanSlug = String(slug || "").trim();

      if (cleanHost && cleanSlug) {
        map[cleanHost] = cleanSlug;
      }
    });

    return map;
  } catch {
    return {};
  }
}

function getBaseHosts() {
  const hosts = new Set<string>();

  const singleBaseHost = normalizeHost(process.env.SITEBUILDER_BASE_HOST || "");
  if (singleBaseHost) hosts.add(singleBaseHost);

  const rawBaseHosts = String(process.env.SITEBUILDER_BASE_HOSTS || "")
    .split(",")
    .map((x) => normalizeHost(x))
    .filter(Boolean);

  rawBaseHosts.forEach((host) => hosts.add(host));

  return hosts;
}

function isLocalOrPreviewHost(host: string) {
  if (!host) return true;

  if (host === "localhost") return true;
  if (host === "127.0.0.1") return true;
  if (host.endsWith(".local")) return true;

  // Do not try to treat Vercel deployment URLs as customer custom domains.
  if (host.endsWith(".vercel.app")) return true;

  return false;
}

function isBypassPath(pathname: string) {
  const path = normalizePath(pathname);

  if (path.startsWith("/_next")) return true;
  if (path.startsWith("/api")) return true;

  if (path === "/favicon.ico") return true;
  if (path === "/robots.txt") return true;
  if (path === "/sitemap.xml") return true;
  if (path === "/manifest.json") return true;

  // File-like public assets.
  if (/\.[a-zA-Z0-9]+$/.test(path)) return true;

  // Builder/private platform routes.
  if (path.startsWith("/sitebuilder")) return true;

  // Public SiteBuilder route should remain directly accessible.
  if (path.startsWith("/p/")) return true;

  return false;
}

function findSlugForHost(host: string, map: Record<string, string>) {
  const cleanHost = normalizeHost(host);
  if (!cleanHost) return "";

  const direct = map[cleanHost];
  if (direct) return direct;

  if (cleanHost.startsWith("www.")) {
    const apex = cleanHost.replace(/^www\./, "");
    return map[apex] || "";
  }

  const www = `www.${cleanHost}`;
  return map[www] || "";
}

export function middleware(req: NextRequest) {
  const host = normalizeHost(req.headers.get("host") || "");
  const pathname = normalizePath(req.nextUrl.pathname);

  if (!host) return NextResponse.next();
  if (isLocalOrPreviewHost(host)) return NextResponse.next();
  if (isBypassPath(pathname)) return NextResponse.next();

  const baseHosts = getBaseHosts();
  if (baseHosts.has(host)) return NextResponse.next();

  const map = parseHostMap();
  const slug = findSlugForHost(host, map);

  if (!slug) return NextResponse.next();

  const url = req.nextUrl.clone();

  url.pathname = `/p/${encodeURIComponent(slug)}`;

  // Keep original path available to your renderer.
  // Example:
  // clientdomain.co.uk/about
  // rewrites to:
  // /p/client-slug?_sb_path=/about
  url.searchParams.set("_sb_host", host);
  url.searchParams.set("_sb_path", pathname);

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/:path*"],
};
