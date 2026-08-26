import { createAdminClient } from '@/lib/supabase/admin';
import { runSearchJob } from '@/lib/searchWorker';
import { buildCacheKey, withListingsCache } from '@/lib/searchCache';
import type { FilterState } from '@/lib/filterOptions';
import type { Listing } from '@/lib/types';
import { convertToUSD } from '@/lib/currency';
import { matchListingSize } from '@/lib/sizeFilter';
import { Resend } from 'resend';
import { buildAlertEmailHtml, buildBaselineEmailHtml } from '@/lib/email/alertEmailTemplate';
import { ALERT_EXCLUDED_PLATFORMS } from '@/lib/alertConstants';
import { nextAnchoredRunAt, cadenceLabel } from '@/lib/alertSchedule';
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
  size?: string | null;        // SIZE_OPTIONS key (e.g. 'l', 'm7_5'); matched via matchListingSize
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
  const size = criteria.size?.trim().toLowerCase();
  const { minPrice, maxPrice } = criteria;
  const hasPriceBound = minPrice != null || maxPrice != null;

  return listings.filter((l) => {
    if (size && !matchListingSize(l.title, size, l.size)) return false;

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

  // Claim this row before doing any work: an optimistic-concurrency UPDATE that
  // only succeeds if next_run_at still matches what the caller read. This is the
  // only guard against double-processing — the real next_run_at (computed at the
  // end of this function) isn't written until after the search + email finish,
  // so without a claim, an overlapping invocation of /api/cron/run-alerts (e.g. a
  // request that outlives nginx's proxy timeout while the batch is still running)
  // would find the same row still "due" and re-run + re-email it. 10 minutes is
  // comfortably longer than a single alert's search but short enough that a
  // crashed run self-heals on the next cron tick instead of getting stuck.
  const claimUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { data: claimed } = await admin
    .from('saved_searches')
    .update({ next_run_at: claimUntil })
    .eq('id', savedSearch.id)
    .eq('next_run_at', savedSearch.next_run_at)
    .select('id');
  if (!claimed || claimed.length === 0) {
    console.log(`[alertRunner] alert=${savedSearch.id} already claimed by another run, skipping`);
    return 0;
  }

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

  // First run seeds the baseline. No in-app notification and no match rows —
  // "new" is still defined strictly as "appeared after the baseline" — but we do
  // send one activation email showing what matches right now, so creating an
  // alert pays off immediately instead of going quiet for a day. This also fires
  // after a baseline-resetting edit (PATCH nulls last_seen_urls), which is the
  // intended behaviour: the alert now watches something different.
  if (isFirstRun) {
    void sendBaselineEmail(savedSearch, listings, platforms.length);
    return 0;
  }

  const newListings = listings.filter((l) => newUrls.includes(l.url));

  // Every (non-first) run produces an in-app notification, even with 0 new
  // matches. This is the "your alert ran today" signal the nav bell badge
  // counts — users wanted confirmation the alert is alive regardless of result.
  const { data: notif } = await admin
    .from('notifications')
    .insert({
      user_id: savedSearch.user_id,
      alert_id: savedSearch.id,
      new_count: newUrls.length,
    })
    .select('id')
    .single();

  // No new matches: the notification above is the whole story. No email.
  if (newUrls.length === 0) return 0;

  // Persist the new listings so they can be browsed in-app (click alert → see
  // matches), then prune to the most recent 500 per alert to bound growth.
  // Drop rows missing the NOT NULL url first — insert() is one statement, so a
  // single bad row would silently fail the whole batch otherwise (this was the
  // root cause of a real alert losing every match for weeks with no error).
  const insertRows = newListings
    .filter((l) => !!l.url)
    .map((l) => ({
      user_id: savedSearch.user_id,
      alert_id: savedSearch.id,
      notification_id: notif?.id ?? null,
      url: l.url,
      title: l.title,
      price: l.price,
      currency: l.currency,
      image: l.image,
      platform: l.platform,
      seller: l.seller,
      size: l.size,
      condition: l.condition,
      color: l.color,
    }));
  if (insertRows.length) {
    const { error: insertErr } = await admin.from('alert_matches').insert(insertRows);
    if (insertErr) {
      console.error(`[alertRunner] alert_matches insert failed for alert=${savedSearch.id}:`, insertErr);
    }
  }
  await pruneAlertMatches(admin, savedSearch.id);

  // Email only when there are new matches.
  void sendAlertEmail(savedSearch, newUrls.length, newListings);

  return newUrls.length;
}

/**
 * Keep only the most recent `keep` matches per alert so the table doesn't grow
 * unbounded (mirrors the 500-URL cap on saved_searches.last_seen_urls).
 */
async function pruneAlertMatches(
  admin: ReturnType<typeof createAdminClient>,
  alertId: string,
  keep = 500,
): Promise<void> {
  const { data } = await admin
    .from('alert_matches')
    .select('id')
    .eq('alert_id', alertId)
    .order('found_at', { ascending: false })
    .range(keep, keep + 1000);
  const stale = (data ?? []).map((r) => r.id);
  if (stale.length) {
    await admin.from('alert_matches').delete().in('id', stale);
  }
}

/**
 * One-off "your alert is live, here is what matches today" email, sent at the
 * end of an alert's first (baseline) run. Deliberately separate from
 * sendAlertEmail: the copy has to make clear these are the starting point, not
 * new finds, or the next real new-matches email reads as a duplicate.
 */
async function sendBaselineEmail(
  savedSearch: SavedSearch,
  listings: Awaited<ReturnType<typeof runSearchJob>>,
  platformCount: number,
) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(savedSearch.user_id);
  const email = authUser?.user?.email;
  if (!email) return;

  const total = listings.length;
  const shown = listings.slice(0, 5);
  const cadenceWord = cadenceLabel(savedSearch.cadence_hours).toLowerCase();

  const subject = total === 0
    ? `Your alert for "${savedSearch.query}" is live`
    : `${total} listing${total === 1 ? '' : 's'} match "${savedSearch.query}" right now`;

  const listingLines = shown.map((l) =>
    `• ${l.title ?? 'Item'} — ${l.price != null ? `$${l.price}` : 'Price unavailable'}\n  ${l.url}`,
  ).join('\n\n');

  const text = total === 0
    ? [
        `Hi,`,
        ``,
        `Your Crawli alert for "${savedSearch.query}" is live, watching ${platformCount} marketplace${platformCount === 1 ? '' : 's'}.`,
        ``,
        `Nothing matches right now. We'll email you the moment something does. If it stays quiet, try a broader query or loosen the size and price filters.`,
        ``,
        `Edit this alert: https://thecrawli.com/alerts`,
        ``,
        `— Crawli`,
      ].join('\n')
    : [
        `Hi,`,
        ``,
        `Your Crawli alert for "${savedSearch.query}" is live. Right now ${total} listing${total === 1 ? '' : 's'} match across ${platformCount} marketplace${platformCount === 1 ? '' : 's'}:`,
        ``,
        listingLines,
        total > shown.length ? `\n…and ${total - shown.length} more matching right now.` : '',
        ``,
        `These are your starting point, not new finds. From here we recheck ${cadenceWord} and only email you listings that appear after today.`,
        ``,
        `Manage this alert: https://thecrawli.com/alerts`,
        ``,
        `— Crawli`,
      ].join('\n');

  await new Resend(resendKey).emails.send({
    from: 'Crawli Alerts <alerts@thecrawli.com>',
    to: email,
    subject,
    text,
    html: buildBaselineEmailHtml({
      query: savedSearch.query,
      totalCount: total,
      platformCount,
      listings: shown,
      cadenceWord,
    }),
  }).catch((err) => {
    console.error(`[alertRunner] baseline email failed for alert=${savedSearch.id}:`, err);
  });
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
    html: buildAlertEmailHtml({
      query: savedSearch.query,
      newCount,
      listings: newListings.slice(0, 5),
      totalNewCount: newListings.length,
    }),
  }).catch((err) => {
    console.error(`[alertRunner] email failed for alert=${savedSearch.id}:`, err);
  });
}
