import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

// Blog posts are plain markdown files in /content/blog. Everything here runs at
// build time on the server (filesystem access), so it never ships to the client
// and never touches the search/scraping request path.

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

/** One FAQ entry, rendered on-page and mirrored into FAQPage JSON-LD. Populate
 * from a post's `faq:` frontmatter (the People Also Ask questions from the
 * content brief). Question + answer must match the visible text exactly —
 * Google requires the structured data to mirror what's on the page. */
export interface BlogFaqItem {
  question: string;
  answer: string;
}

export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO yyyy-mm-dd — first published
  updated?: string; // ISO yyyy-mm-dd — last meaningful edit, drives dateModified
  cover?: string;
  tags: string[];
  faq: BlogFaqItem[];
  compareSlug?: string; // maps this post to a live /compare/[slug] item, drives LivePriceTable
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
  // marked renders bare <table> with no wrapper, so the overflow-x:auto rule on
  // .blog-content .table-wrapper (globals.css) never applies — a wide table
  // (long headers, many columns) then overflows the whole page horizontally
  // on mobile instead of just scrolling within itself.
  const html = (marked.parse(content, { async: false }) as string).replace(
    /<table>([\s\S]*?)<\/table>/g,
    '<div class="table-wrapper"><table>$1</table></div>',
  );

  // Keep only well-formed { question, answer } pairs; both must be non-empty so
  // the on-page FAQ and the FAQPage JSON-LD never carry blank entries.
  const faq: BlogFaqItem[] = Array.isArray(data.faq)
    ? data.faq
        .filter(
          (f: unknown): f is BlogFaqItem =>
            !!f &&
            typeof (f as BlogFaqItem).question === 'string' &&
            typeof (f as BlogFaqItem).answer === 'string' &&
            (f as BlogFaqItem).question.trim().length > 0 &&
            (f as BlogFaqItem).answer.trim().length > 0,
        )
        .map((f: BlogFaqItem) => ({ question: f.question.trim(), answer: f.answer.trim() }))
    : [];

  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? '',
    date: data.date ? String(data.date).slice(0, 10) : '',
    updated: data.updated ? String(data.updated).slice(0, 10) : undefined,
    cover: data.cover ?? undefined,
    tags: Array.isArray(data.tags) ? data.tags : [],
    faq,
    compareSlug: typeof data.compareSlug === 'string' ? data.compareSlug : undefined,
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

/** Maps a compare item's slug (e.g. "jordan-1-retro-high") to the blog post
 * slug of its price-guide article, for posts that set `compareSlug` in
 * frontmatter. Used to link /compare/[slug] and the landing page's compare
 * cards to their written analysis. */
export function getPriceGuideSlugMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const post of getAllPosts()) {
    if (post.compareSlug) map.set(post.compareSlug, post.slug);
  }
  return map;
}

/** Slugs for generateStaticParams. */
export function getAllSlugs(): string[] {
  return readSlugs();
}
