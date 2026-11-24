import type { GetServerSideProps } from "next";
import { getServerSiteUrl } from "../lib/site-url";

const publicPaths = ["/", "/winter-arc"];

export const getServerSideProps: GetServerSideProps = async ({
  res,
}) => {
  const siteUrl = getServerSiteUrl();
  const urls = siteUrl
    ? publicPaths
        .map(
          (path) => `
    <url>
      <loc>${siteUrl}${path}</loc>
    </url>`
        )
        .join("")
    : "";
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=86400");
  res.write(sitemap);
  res.end();

  return { props: {} };
};

export default function Sitemap() {
  return null;
}
