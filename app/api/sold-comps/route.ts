// Sold comps for a query. Deliberately separate from /api/search: the streaming
// NDJSON protocol there is fragile, and this has a completely different cost
// profile (two plain HTTP requests, no browser, no Firecrawl).
//
// Does NOT consume a search credit. It rides along with a search the user already
// paid for, and charging for it would suppress the exposure EXP-004 needs.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSoldComps } from '@/lib/soldComps';
import type { SoldCompsResult } from '@/lib/soldComps';

const CACHE_TTL_SECONDS = 24 * 60 * 60;

const bodySchema = z.object({
  query: z.string().min(1).max(200),
});

/** Same normalization idea as lib/searchCache: "nike hoodie" and "hoodie nike" are
 *  the same request to both upstream platforms, so they should share a cache row. */
function cacheKey(query: string): string {
  const tokens = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .sort();
  return `soldcomps::${tokens.join(' ')}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const key = cacheKey(parsed.query);
  const admin = createAdminClient();

  const { data: cached } = await admin
    .from('sold_comps_cache')
    .select('payload, expires_at')
    .eq('key', key)
    .maybeSingle();

  if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
    return NextResponse.json(cached.payload as SoldCompsResult);
  }

  let result: SoldCompsResult;
  try {
    result = await getSoldComps(parsed.query);
  } catch (err) {
    console.error('[/api/sold-comps] failed', err);
    return NextResponse.json(
      { available: false, platforms: [], errors: ['internal'] },
      { status: 200 },
    );
  }

  // Only cache a usable answer. Caching `available: false` would pin a transient
  // upstream failure in place for 24h — the same reason the sidecar's search cache
  // skips empty results.
  if (result.available) {
    const { error } = await admin.from('sold_comps_cache').upsert({
      key,
      payload: result,
      expires_at: new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString(),
    });
    if (error) console.error('[/api/sold-comps] cache write failed', error);
  }

  return NextResponse.json(result);
}
