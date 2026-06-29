import { createAdminClient } from '@/lib/supabase/admin';
import { runSearchJob } from '@/lib/searchWorker';
import { buildCacheKey, withListingsCache } from '@/lib/searchCache';
import type { FilterState } from '@/lib/filterOptions';
import type { Listing } from '@/lib/types';
import { convertToUSD } from '@/lib/currency';
import { Resend } from 'resend';
import { ALERT_EXCLUDED_PLATFORMS } from '@/lib/alertConstants';
import { nextAnchoredRunAt } from '@/lib/alertSchedule';
import { TIER_CAPS, type Tier } from '@/lib/stripe';

export { ALERT_EXCLUDED_PLATFORMS };

/**
 * Hyper-specific boolean sourcing criteria layered on top of a saved search.
 * AND-only this session: every populated field must match for a listing to
 * count (e.g. brand AND size AND price < X). OR-within-a-field (brand A OR
 * brand B) is a flagged later extension. Matching happens in `applyCriteria`
 * over already-fetched listings — NEVER inside searchWorker (Session-4 owns it).
 */
export interface AlertCriteria {
  brand?: string | null;       // must appear in listing.title (case-insensitive)
  keywordsAll?: string[];      // every token must appear in listing.title
  size?: string | null;        // must appear in listing.size or title
  minPrice?: number | null;    // listing price >= minPrice (USD-normalized)
  maxPrice?: number | null;    // listing price <= maxPrice (USD-normalized)
}

export interface SavedSearch {
  id: string;
  user_id: string;
  query: string;
  platforms: string[];
  filters: FilterState | null;
  criteria: AlertCriteria | null;
  cadence_hours: number;
  last_seen_urls: string[] | null;
  unread_match_count: number;
  paused: boolean;
  next_run_at: string;
  notify_timezone: string | null;
}

/** USD-normalized price for a listing, or null if not convertible. */
function priceInUSD(listing: Listing): number | null {
  if (listing.price == null) return null;
  if (listing.currency === 'USD') return listing.price;
  return convertToUSD(listing.price, listing.currency);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Size match: prefer the structured `size` field (substring is fine — values are
 * like 'm', 'm7_5'); fall back to a WHOLE-WORD match in the title so a
 * single-letter size like "M" doesn't false-match inside words like "atom".
 */
function sizeMatches(listing: Listing, size: string): boolean {
  if ((listing.size ?? '').toLowerCase().includes(size)) return true;
  return new RegExp(`\\b${escapeRegExp(size)}\\b`, 'i').test(listing.title ?? '');
}

/**
 * AND-only post-filter for boolean sourcing criteria. Returns listings that
 * satisfy every populated criterion. A null/empty criteria object is a no-op
 * (legacy alerts behave exactly as before).
 */
export function applyCriteria(
  listings: Listing[],
  criteria: AlertCriteria | null | undefined,
): Listing[] {
  if (!criteria) return listings;
  const brand = criteria.brand?.trim().toLowerCase();
  const keywords = (criteria.keywordsAll ?? [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  const size = criteria.size?.trim().toLowerCase();
  const { minPrice, maxPrice } = criteria;
  const hasPriceBound = minPrice != null || maxPrice != null;

  return listings.filter((l) => {
    const title = (l.title ?? '').toLowerCase();

    if (brand && !title.includes(brand)) return false;
    if (keywords.length && !keywords.every((k) => title.includes(k))) return false;
    if (size && !sizeMatches(l, size)) return false;

    if (hasPriceBound) {
      const usd = priceInUSD(l);
      if (usd == null) return false; // a price bound is set but this listing has no usable price
      if (minPrice != null && usd < minPrice) return false;
      if (maxPrice != null && usd > maxPrice) return false;
    }

    return true;
  });
}

// Called by /api/cron/run-alerts for each due saved search.
// Returns the count of new matches found (0 on first run — suppressed).
export async function runAlert(savedSearch: SavedSearch): Promise<number> {
  const admin = createAdminClient();
  const isFirstRun = !savedSearch.last_seen_urls;

  const platforms = savedSearch.platforms.filter(
    (p) => !ALERT_EXCLUDED_PLATFORMS.has(p),
  );

  // Owner's tier dictates the native-platform results cap on this run.
  // Derived from TIER_CAPS (single source of truth) so a tier-cap bump
  // auto-applies without a DB backfill — see /api/search route for the same
  // pattern. subscription_status drives whether a profile-without-tier-set
  // counts as paid.
  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('subscription_status, subscription_tier')
    .eq('id', savedSearch.user_id)
    .single();
  const isPaid = ownerProfile?.subscription_status === 'active'
    || ownerProfile?.subscription_status === 'past_due';
  const tier: Tier = (ownerProfile?.subscription_tier as Tier | null)
    ?? (isPaid ? 'pro' : 'free');
  const nativeCap = TIER_CAPS[tier].nativeResultsCap;

  let listings: Awaited<ReturnType<typeof runSearchJob>> = [];
  try {
    const cacheKey = buildCacheKey(savedSearch.query, platforms, savedSearch.filters ?? undefined);
    listings = await withListingsCache(cacheKey, () =>
      runSearchJob(savedSearch.query, platforms, savedSearch.filters ?? undefined, undefined, nativeCap),
    );
  } catch (err) {
    console.error(`[alertRunner] search failed for alert=${savedSearch.id}:`, err);
  }

  // AND-only boolean sourcing criteria (brand AND size AND price<X). No-op for
  // legacy alerts where criteria is null.
  listings = applyCriteria(listings, savedSearch.criteria);

  const currentUrls = listings.map((l) => l.url);
  const lastSeen = new Set(savedSearch.last_seen_urls ?? []);
  const newUrls = currentUrls.filter((u) => !lastSeen.has(u));

  // Merge old + new, cap at 500 to bound row size (~30KB)
  const updatedSeen = [
    ...(savedSearch.last_seen_urls ?? []),
    ...newUrls,
  ].slice(-500);

  const now = new Date();
  // Anchor next run to 9 AM in the user's timezone so emails land at a sensible
  // local time. Falls back to "+ cadence hours" if no timezone is stored.
  const nextRun = savedSearch.notify_timezone
    ? nextAnchoredRunAt(savedSearch.notify_timezone, savedSearch.cadence_hours, now)
    : new Date(now.getTime() + savedSearch.cadence_hours * 60 * 60 * 1000);

  await admin
    .from('saved_searches')
    .update({
      last_seen_urls: updatedSeen,
      last_run_at: now.toISOString(),
      next_run_at: nextRun.toISOString(),
      // First run: populate last_seen_urls silently, no unread increment
      unread_match_count: isFirstRun
        ? 0
        : savedSearch.unread_match_count + newUrls.length,
    })
    .eq('id', savedSearch.id);

  // First run: never notify — just seed the URL set
  if (isFirstRun || newUrls.length === 0) return 0;

  // Notify: in-app (Supabase Realtime fires automatically on the UPDATE above)
  // + email for pro users
  void sendAlertEmail(savedSearch, newUrls.length, listings.filter((l) =>
    newUrls.includes(l.url),
  ));

  return newUrls.length;
}

async function sendAlertEmail(
  savedSearch: SavedSearch,
  newCount: number,
  newListings: Awaited<ReturnType<typeof runSearchJob>>,
) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const admin = createAdminClient();

  // Get user email from auth
  const { data: authUser } = await admin.auth.admin.getUserById(savedSearch.user_id);
  const email = authUser?.user?.email;
  if (!email) return;

  // All users (free + pro) receive per-alert emails. Free is capped to 1 alert
  // by max_saved_searches, so per-alert email volume stays bounded.
  const resend = new Resend(resendKey);

  const listingLines = newListings.slice(0, 5).map((l) =>
    `• ${l.title ?? 'Item'} — ${l.price != null ? `$${l.price}` : 'Price unavailable'}\n  ${l.url}`,
  ).join('\n\n');

  await resend.emails.send({
    from: 'Crawli Alerts <alerts@thecrawli.com>',
    to: email,
    subject: `${newCount} new match${newCount > 1 ? 'es' : ''} for "${savedSearch.query}"`,
    text: [
      `Hi,`,
      ``,
      `Your Crawli alert for "${savedSearch.query}" found ${newCount} new listing${newCount > 1 ? 's' : ''}:`,
      ``,
      listingLines,
      newListings.length > 5 ? `\n…and ${newListings.length - 5} more.` : '',
      ``,
      `View all results: https://thecrawli.com/alerts`,
      ``,
      `— Crawli`,
    ].join('\n'),
  }).catch((err) => {
    console.error(`[alertRunner] email failed for alert=${savedSearch.id}:`, err);
  });
}
