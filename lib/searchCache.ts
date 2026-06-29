import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { FilterState } from '@/lib/filterOptions';
import type { Listing, SearchStreamEvent } from '@/lib/types';

const DEFAULT_TTL_SECONDS = 3600;

export function cacheEnabled(): boolean {
  return (process.env.SEARCH_CACHE_ENABLED ?? '1') !== '0';
}

function ttlSeconds(): number {
  const v = parseInt(process.env.SEARCH_CACHE_TTL_SECONDS ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_TTL_SECONDS;
}

function canonicalFilters(filters: FilterState | undefined): Record<string, unknown> {
  if (!filters) return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(filters).sort()) {
    const v = (filters as unknown as Record<string, unknown>)[key];
    if (v === null || v === undefined || v === '') continue;
    out[key] = v;
  }
  return out;
}

// Normalization is for cache-key hashing ONLY. The original query is sent to
// the providers verbatim; we just want "nike hoodie white" and "white-nike
// hoodie" to hit the same cache row since platforms treat them identically.
function normalizeQuery(query: string): string {
  const stripped = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ') // drop punctuation; keep letters/numbers
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = stripped.split(' ').filter(Boolean).sort();
  return tokens.join(' ');
}

export function buildCacheKey(
  query: string,
  platforms: string[],
  filters: FilterState | undefined,
): string {
  const payload = JSON.stringify({
    q: normalizeQuery(query),
    p: [...platforms].sort(),
    f: canonicalFilters(filters),
  });
  return createHash('sha256').update(payload).digest('hex');
}

export async function getCachedEvents(key: string): Promise<SearchStreamEvent[] | null> {
  if (!cacheEnabled()) return null;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('search_cache')
      .select('events, expires_at')
      .eq('key', key)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error || !data) return null;
    return data.events as SearchStreamEvent[];
  } catch (err) {
    console.error('[search-cache] read failed:', err);
    return null;
  }
}

export async function setCachedEvents(
  key: string,
  events: SearchStreamEvent[],
): Promise<void> {
  if (!cacheEnabled()) return;
  try {
    const supabase = createAdminClient();
    const ttl = ttlSeconds();
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    const { error } = await supabase
      .from('search_cache')
      .upsert({ key, events, expires_at: expiresAt }, { onConflict: 'key' });
    if (error) console.error('[search-cache] write failed:', error.message);
  } catch (err) {
    console.error('[search-cache] write failed:', err);
  }
}

// ── Cross-user listings cache (Track B) ────────────────────────────────────
// The NDJSON events cache above is the streaming /api/search path's replay
// cache. Alert runs don't stream — runAlert -> runSearchJob returns Listing[].
// This pair caches that Listing[] so N users watching the SAME query/platforms/
// filters share ONE scrape (50 watchers = 1 scrape, fanned out). Keyed by the
// same buildCacheKey, so it's user-agnostic by construction. Stored in its own
// table to keep the events/listings shapes from colliding on one column.

export async function getCachedListings(key: string): Promise<Listing[] | null> {
  if (!cacheEnabled()) return null;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('search_listings_cache')
      .select('listings, expires_at')
      .eq('key', key)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error || !data) return null;
    return data.listings as Listing[];
  } catch (err) {
    console.error('[search-cache] listings read failed:', err);
    return null;
  }
}

export async function setCachedListings(key: string, listings: Listing[]): Promise<void> {
  if (!cacheEnabled()) return;
  try {
    const supabase = createAdminClient();
    const expiresAt = new Date(Date.now() + ttlSeconds() * 1000).toISOString();
    const { error } = await supabase
      .from('search_listings_cache')
      .upsert({ key, listings, expires_at: expiresAt }, { onConflict: 'key' });
    if (error) console.error('[search-cache] listings write failed:', error.message);
  } catch (err) {
    console.error('[search-cache] listings write failed:', err);
  }
}

// Cache-first wrapper. Takes the search runner as a param so this module never
// imports searchWorker (avoids a cycle). On a miss, runs the search and populates
// the cache; empty results are NOT cached so a transient zero-result run doesn't
// get pinned for the whole TTL. Wired into alertRunner.runAlert (2026-06-28).
export async function withListingsCache(
  key: string,
  runner: () => Promise<Listing[]>,
): Promise<Listing[]> {
  const cached = await getCachedListings(key);
  if (cached) return cached;
  const listings = await runner();
  if (listings.length > 0) await setCachedListings(key, listings);
  return listings;
}
