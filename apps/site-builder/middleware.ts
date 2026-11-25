import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

function parseLegacyHostMap() {
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
      if (cleanHost && cleanSlug) map[cleanHost] = cleanSlug;
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

  String(process.env.SITEBUILDER_BASE_HOSTS || "")
    .split(",")
    .map(normalizeHost)
    .filter(Boolean)
    .forEach((host) => hosts.add(host));

  return hosts;
}

function isLocalOrPreviewHost(host: string) {
  return (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    host.endsWith(".vercel.app")
  );
}

function isInfrastructurePath(pathname: string) {
  const path = normalizePath(pathname);
  return (
    path.startsWith("/_next") ||
    path.startsWith("/api") ||
    path === "/favicon.ico" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path === "/manifest.json" ||
    path.startsWith("/sitebuilder") ||
    path.startsWith("/p/") ||
    /\.[a-zA-Z0-9]+$/.test(path)
  );
}

function findLegacySlug(host: string, map: Record<string, string>) {
  if (map[host]) return map[host];
  if (host.startsWith("www.")) return map[host.slice(4)] || "";
  return map[`www.${host}`] || "";
}

export function middleware(req: NextRequest) {
  const host = normalizeHost(req.headers.get("host") || "");
  const pathname = normalizePath(req.nextUrl.pathname);

  if (isLocalOrPreviewHost(host)) return NextResponse.next();
  if (getBaseHosts().has(host)) return NextResponse.next();
  if (isInfrastructurePath(pathname)) return NextResponse.next();

  const url = req.nextUrl.clone();
  const legacySlug = findLegacySlug(host, parseLegacyHostMap());
  if (legacySlug) {
    url.pathname = `/p/${encodeURIComponent(legacySlug)}`;
    url.searchParams.set("_sb_host", host);
  } else {
    url.pathname = "/p/__domain";
    url.searchParams.set("_sb_domain", "1");
  }
  url.searchParams.set("_sb_path", pathname);

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/:path*"],
};
