import Head from "next/head";
import { getCanonicalUrl } from "../lib/site-url";

type SeoProps = {
  title: string;
  description: string;
  path: string;
  image?: string;
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
};

export default function Seo({
  title,
  description,
  path,
  image = "/images/GymFrontView.jpeg",
  structuredData,
}: SeoProps) {
  const canonicalUrl = getCanonicalUrl(path);
  const imageUrl = getCanonicalUrl(image);
  const jsonLd = structuredData
    ? JSON.stringify(structuredData).replace(/</g, "\\u003c")
    : undefined;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      {canonicalUrl && (
        <link rel="canonical" href={canonicalUrl} />
      )}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {canonicalUrl && (
        <meta property="og:url" content={canonicalUrl} />
      )}
      {imageUrl && (
        <meta property="og:image" content={imageUrl} />
      )}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {imageUrl && (
        <meta name="twitter:image" content={imageUrl} />
      )}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      )}
    </Head>
  );
}
