export function resolveSiteBuilderRedirectUrl(
  url: string,
  siteBuilderUrl: string
) {
  const siteBuilderOrigin = new URL(siteBuilderUrl).origin;

  try {
    const destination = new URL(url, siteBuilderOrigin);
    return destination.origin === siteBuilderOrigin
      ? destination.href
      : siteBuilderOrigin;
  } catch {
    return siteBuilderOrigin;
  }
}
