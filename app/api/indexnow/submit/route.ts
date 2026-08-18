import { NextResponse } from 'next/server';
import sitemap from '@/app/sitemap';
import { submitToIndexNow } from '@/lib/indexnow';

export const dynamic = 'force-dynamic';

// Public, indexable URLs, derived from app/sitemap.ts rather than rebuilt here.
// This list used to be maintained by hand and silently drifted — it omitted the
// /compare hub, which Bing Webmaster Tools then flagged as "important page not
// submitted via IndexNow". Reading the sitemap is the single source of truth,
// so a new public route can never be in one list but not the other.
async function buildAllUrls(): Promise<string[]> {
  return (await sitemap()).map((entry) => entry.url);
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
