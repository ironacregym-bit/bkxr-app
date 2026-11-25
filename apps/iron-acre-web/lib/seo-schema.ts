import { getCanonicalUrl } from "./site-url";

type FaqEntry = {
  question: string;
  answer: string;
};

type LocalServiceSchemaOptions = {
  serviceName: string;
  serviceType: string;
  description: string;
  price?: number;
  priceUnit?: string;
  faqs?: FaqEntry[];
};

export function localServiceSchema({
  serviceName,
  serviceType,
  description,
  price,
  priceUnit = "per class",
  faqs = [],
}: LocalServiceSchemaOptions) {
  const locationId = getCanonicalUrl("/") || "https://ironacregym.co.uk/";
  const graph: Record<string, unknown>[] = [
    {
      "@type": "SportsActivityLocation",
      "@id": locationId,
      name: "Iron Acre Gym",
      description:
        "Outdoor strength and conditioning training in Westerfield, Ipswich, Suffolk.",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Westerfield, Ipswich",
        addressRegion: "Suffolk",
        addressCountry: "GB",
      },
      areaServed: ["Westerfield", "Ipswich", "Suffolk"],
    },
    {
      "@type": "Service",
      name: serviceName,
      serviceType,
      description,
      provider: { "@id": locationId },
      areaServed: "Ipswich, Suffolk",
      ...(price === undefined
        ? {}
        : {
            offers: {
              "@type": "Offer",
              priceSpecification: {
                "@type": "UnitPriceSpecification",
                price: String(price),
                priceCurrency: "GBP",
                unitText: priceUnit,
              },
            },
          }),
    },
  ];

  if (faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faqs.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: answer,
        },
      })),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}
