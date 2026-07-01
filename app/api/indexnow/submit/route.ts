import { NextResponse } from 'next/server';
import { getAllPosts } from '@/lib/blog';
import { getAllCompareItems } from '@/lib/compare';
import { submitToIndexNow } from '@/lib/indexnow';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thecrawli.com';

// Public, indexable URLs — mirrors app/sitemap.ts. Kept in sync manually; both
// derive from the same getAllPosts()/getAllCompareItems() sources.
async function buildAllUrls(): Promise<string[]> {
  const posts = getAllPosts().map((p) => `${SITE_URL}/blog/${p.slug}`);
  const compare = (await getAllCompareItems()).map((i) => `${SITE_URL}/compare/${i.slug}`);
  const staticPages = ['', '/blog', '/pricing', '/contact', '/privacy', '/terms'].map(
    (p) => `${SITE_URL}${p}`,
  );
  return [...staticPages, ...posts, ...compare];
}

/**
 * Resubmit URLs to IndexNow. Called from the deploy step (no body → resubmit the
 * whole sitemap) or with an explicit { urls } list. Bearer-auth'd with
 * CRON_SECRET, matching app/api/compare/refresh/route.ts.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let urls: string[];
  try {
    const body = (await request.json().catch(() => ({}))) as { urls?: unknown };
    urls = Array.isArray(body.urls) && body.urls.length > 0
      ? (body.urls.filter((u): u is string => typeof u === 'string'))
      : await buildAllUrls();
  } catch {
    urls = await buildAllUrls();
  }

  const ok = await submitToIndexNow(urls);
  return NextResponse.json({ ok, submitted: urls.length, at: new Date().toISOString() });
}
