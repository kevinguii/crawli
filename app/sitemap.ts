import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";
import { getAllCompareItems } from "@/lib/compare";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thecrawli.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const blogPosts: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : lastModified,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const compareItems = await getAllCompareItems();
  const comparePages: MetadataRoute.Sitemap = compareItems.map((item) => ({
    url: `${SITE_URL}/compare/${item.slug}`,
    lastModified,
    changeFrequency: "daily" as const,
    priority: 0.85,
  }));

  // Only public, indexable, canonical URLs. Protected app routes and API
  // endpoints are intentionally excluded (and disallowed in robots.ts).
  return [
    {
      url: `${SITE_URL}/blog`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...blogPosts,
    ...comparePages,
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
