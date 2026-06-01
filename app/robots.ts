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
          // Query-param traps (sort/view/filter states + raw search queries).
          "/*?*sort=",
          "/*?*view=",
          "/*?*q=",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
