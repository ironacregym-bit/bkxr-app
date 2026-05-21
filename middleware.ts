// File: middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Custom domain root serving (phase 1)
 *
 * Because Next.js middleware runs on the Edge runtime, we can't use the Google Firestore Node SDK here.
 * So we use an env mapping that you can set in Vercel:
 *
 * SITEBUILDER_HOSTS_JSON='{"client.com":"acme","www.client.com":"acme"}'
 *
 * Later (phase 2) we can automate this via Edge Config or a KV store.
 */

function normalizeHost(host: string) {
  return String(host || "").trim().toLowerCase().split(":")[0];
}

function isBypassPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  // allow direct access to the builder and platform pages
  if (pathname.startsWith("/sitebuilder")) return true;
  if (pathname.startsWith("/p/")) return true;
  // allow your existing app routes to function normally on your main host
  return false;
}

export function middleware(req: NextRequest) {
  const host = normalizeHost(req.headers.get("host") || "");
  const pathname = req.nextUrl.pathname;

  if (!host) return NextResponse.next();
  if (isBypassPath(pathname)) return NextResponse.next();

  // Do not rewrite for your main app host (set in env).
  const baseHost = normalizeHost(process.env.SITEBUILDER_BASE_HOST || "");
  if (baseHost && host === baseHost) return NextResponse.next();

  // Parse host->slug mapping
  let map: Record<string, string> = {};
  try {
    const raw = process.env.SITEBUILDER_HOSTS_JSON || "{}";
    map = JSON.parse(raw);
  } catch {
    map = {};
  }

  const slug = map[host];
  if (!slug) return NextResponse.next();

  // Rewrite ALL non-bypass requests on that host to the public site renderer.
  const url = req.nextUrl.clone();
  url.pathname = `/p/${encodeURIComponent(slug)}`;
  // keep original path as a hint (optional)
  url.searchParams.set("_sb_path", pathname);

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/:path*"],
};
