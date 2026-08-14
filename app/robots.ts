import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecrawli.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Default policy + explicitly allowed AI answer-engine crawlers
        // (OAI-SearchBot / PerplexityBot drive shopping referral traffic).
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/login",
          "/forgot-password",
          "/check-email",
          // Auth-gated app surface — never index logged-in views.
          "/search",
          "/watchlist",
          "/saves",
          "/alerts",
          "/search-history",
          "/profile",
          "/settings",
          "/monitoring",
          "/watchlist-demo",
          // Query-param traps (sort/view/filter states).
          "/*?*sort=",
          "/*?*view=",
          // NOTE: the old blanket "/*?*q=" rule is gone. It existed to keep raw
          // search queries out, but /search is already fully disallowed above,
          // so it was redundant there — and it blocked /compare/search?q=, the
          // public search target declared as SearchAction in StructuredData.tsx.
          // That page is crawlable on purpose but carries robots: noindex,follow,
          // so agents can verify the search works without ?q= permutations
          // bloating the index.
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
