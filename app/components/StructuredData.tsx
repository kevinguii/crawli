import { FAQ_ITEMS } from "@/app/components/landing/faqData";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecrawli.com";

const PLATFORMS = [
  "Grailed",
  "Depop",
  "Poshmark",
  "StockX",
  "Mercari",
  "Vinted",
  "eBay",
  "Vestiaire Collective",
];

/**
 * Server-rendered JSON-LD for the landing page. Crawlers and AI answer engines
 * read this directly from the HTML without executing JavaScript.
 *
 * - Organization + WebSite (with SearchAction) establish the brand entity and
 *   make Crawli eligible for the sitelinks search box.
 * - SoftwareApplication describes the product (a free shopping/search app).
 * - FAQPage mirrors the on-page FAQ (see faqData.ts).
 *
 * Note: no Product schema here — that's only valid on single-item pages, not a
 * multi-result landing page.
 */
export default function StructuredData() {
  const graph = [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Crawli",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      description:
        "Crawli is a resale price search engine that compares secondhand fashion listings across eight marketplaces in one search.",
      contactPoint: {
        "@type": "ContactPoint",
        email: "hello@thecrawli.com",
        contactType: "customer support",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Crawli",
      description:
        "Compare resale prices across Grailed, Depop, Poshmark, StockX, Mercari, Vinted, eBay and Vestiaire in one search.",
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      name: "Crawli",
      applicationCategory: "ShoppingApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description:
        "Search Grailed, Depop, Poshmark, StockX, Mercari, Vinted, eBay and Vestiaire at once to compare secondhand fashion prices and find the best deal.",
      featureList: [
        "Cross-platform resale price comparison",
        "Search 8 marketplaces simultaneously",
        ...PLATFORMS.map((p) => `Search ${p}`),
        "Daily search alerts for new listings",
        "Save and track listings",
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": graph,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
