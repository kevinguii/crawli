import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { FilterState } from '@/lib/filterOptions';
import type { SearchStreamEvent } from '@/lib/types';

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

export function buildCacheKey(
  query: string,
  platforms: string[],
  filters: FilterState | undefined,
): string {
  const payload = JSON.stringify({
    q: query.trim().toLowerCase().replace(/\s+/g, ' '),
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
