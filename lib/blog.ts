import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

// Blog posts are plain markdown files in /content/blog. Everything here runs at
// build time on the server (filesystem access), so it never ships to the client
// and never touches the search/scraping request path.

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO yyyy-mm-dd
  cover?: string;
  tags: string[];
}

export interface Post extends PostMeta {
  html: string;
}

function readSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));
}

function parse(slug: string): Post | null {
  const file = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const { data, content } = matter(raw);
  const html = marked.parse(content, { async: false }) as string;
  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? '',
    date: data.date ? String(data.date).slice(0, 10) : '',
    cover: data.cover ?? undefined,
    tags: Array.isArray(data.tags) ? data.tags : [],
    html,
  };
}

/** All posts, newest first. Used by the listing page and the sitemap. */
export function getAllPosts(): PostMeta[] {
  return readSlugs()
    .map(parse)
    .filter((p): p is Post => p !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(({ html: _html, ...meta }) => meta);
}

/** Single post by slug, or null if it doesn't exist. */
export function getPost(slug: string): Post | null {
  return parse(slug);
}

/** Slugs for generateStaticParams. */
export function getAllSlugs(): string[] {
  return readSlugs();
}
