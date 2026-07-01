import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { getAllCompareItems, getCompareLastUpdated } from "@/lib/compare";
import { gitLastModified } from "@/lib/gitLastModified";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecrawli.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Accurate <lastmod> per URL type — Bing/Google discount the freshness signal
  // when it always reads "now". Posts use their frontmatter dates, compare pages
  // use real scrape times, static pages use their last git commit.
  const blogPosts: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updated || post.date || Date.now()),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const compareItems = await getAllCompareItems();
  const compareLastUpdated = await getCompareLastUpdated();
  const comparePages: MetadataRoute.Sitemap = compareItems.map((item) => ({
    url: `${SITE_URL}/compare/${item.slug}`,
    lastModified: new Date(compareLastUpdated.get(item.slug) ?? Date.now()),
    changeFrequency: "daily" as const,
    priority: 0.85,
  }));

  // Only public, indexable, canonical URLs. Protected app routes and API
  // endpoints are intentionally excluded (and disallowed in robots.ts).
  return [
    {
      url: `${SITE_URL}/blog`,
      lastModified: gitLastModified("app/blog/page.tsx"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...blogPosts,
    ...comparePages,
    {
      url: `${SITE_URL}/`,
      lastModified: gitLastModified("app/page.tsx"),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: gitLastModified("app/pricing/page.tsx"),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: gitLastModified("app/contact/page.tsx"),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: gitLastModified("app/privacy/page.tsx"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: gitLastModified("app/terms/page.tsx"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
