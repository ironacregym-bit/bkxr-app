export const SITEBUILDER_PRODUCTION_URL =
  "https://site-builder-two-pi.vercel.app";

type SiteBuilderOriginOptions = {
  siteBuilderUrl?: string;
  deploymentUrl?: string;
  isPreview?: boolean;
  fallbackUrl?: string;
};

function asOrigin(value: string) {
  return new URL(value.includes("://") ? value : `https://${value}`).origin;
}

export function getSiteBuilderOrigin({
  siteBuilderUrl,
  deploymentUrl,
  isPreview,
  fallbackUrl,
}: SiteBuilderOriginOptions) {
  if (siteBuilderUrl) return asOrigin(siteBuilderUrl);
  if (isPreview && deploymentUrl) return asOrigin(deploymentUrl);
  if (fallbackUrl) return asOrigin(fallbackUrl);
  return SITEBUILDER_PRODUCTION_URL;
}

export function resolveSiteBuilderRedirectUrl(
  url: string,
  siteBuilderUrl: string
) {
  const siteBuilderOrigin = new URL(siteBuilderUrl).origin;
  const adminUrl = `${siteBuilderOrigin}/sitebuilder`;

  try {
    const destination = new URL(url, siteBuilderOrigin);
    return destination.origin === siteBuilderOrigin
      ? destination.href
      : adminUrl;
  } catch {
    return adminUrl;
  }
}
