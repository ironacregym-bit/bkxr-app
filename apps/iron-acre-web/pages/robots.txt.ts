import type { GetServerSideProps } from "next";
import { getServerSiteUrl } from "../lib/site-url";

export const getServerSideProps: GetServerSideProps = async ({
  res,
}) => {
  const siteUrl = getServerSiteUrl();
  const isPreview = process.env.VERCEL_ENV === "preview";
  const sitemapLine = siteUrl
    ? `\nSitemap: ${siteUrl}/sitemap.xml`
    : "";
  const robots = isPreview
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *
Allow: /
Disallow: /api/${sitemapLine}
`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=86400");
  res.write(robots);
  res.end();

  return { props: {} };
};

export default function Robots() {
  return null;
}
