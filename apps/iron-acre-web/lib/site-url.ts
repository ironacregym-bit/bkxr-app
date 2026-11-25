export function getPublicSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "";
}

export function getServerSiteUrl() {
  return getPublicSiteUrl();
}

export function getCanonicalUrl(path: string) {
  const siteUrl = getPublicSiteUrl();
  if (!siteUrl) return undefined;

  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
