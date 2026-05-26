import { createAdminClient } from '@/lib/supabase/admin';
import { runSearchJob } from '@/lib/searchWorker';
import type { FilterState } from '@/lib/filterOptions';
import { Resend } from 'resend';
import { ALERT_EXCLUDED_PLATFORMS } from '@/lib/alertConstants';

export { ALERT_EXCLUDED_PLATFORMS };

export interface SavedSearch {
  id: string;
  user_id: string;
  query: string;
  platforms: string[];
  filters: FilterState | null;
  cadence_hours: number;
  last_seen_urls: string[] | null;
  unread_match_count: number;
  paused: boolean;
  next_run_at: string;
}

// Called by /api/cron/run-alerts for each due saved search.
// Returns the count of new matches found (0 on first run — suppressed).
export async function runAlert(savedSearch: SavedSearch): Promise<number> {
  const admin = createAdminClient();
  const isFirstRun = !savedSearch.last_seen_urls;

  const platforms = savedSearch.platforms.filter(
    (p) => !ALERT_EXCLUDED_PLATFORMS.has(p),
  );

  let listings: Awaited<ReturnType<typeof runSearchJob>> = [];
  try {
    listings = await runSearchJob(
      savedSearch.query,
      platforms,
      savedSearch.filters ?? undefined,
    );
  } catch (err) {
    console.error(`[alertRunner] search failed for alert=${savedSearch.id}:`, err);
  }

  const currentUrls = listings.map((l) => l.url);
  const lastSeen = new Set(savedSearch.last_seen_urls ?? []);
  const newUrls = currentUrls.filter((u) => !lastSeen.has(u));

  // Merge old + new, cap at 500 to bound row size (~30KB)
  const updatedSeen = [
    ...(savedSearch.last_seen_urls ?? []),
    ...newUrls,
  ].slice(-500);

  const now = new Date();
  const nextRun = new Date(now.getTime() + savedSearch.cadence_hours * 60 * 60 * 1000);

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
  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_status, email:id')
    .eq('id', savedSearch.user_id)
    .single();

  // Get user email from auth
  const { data: authUser } = await admin.auth.admin.getUserById(savedSearch.user_id);
  const email = authUser?.user?.email;
  if (!email) return;

  const isPro = profile?.subscription_status === 'active' || profile?.subscription_status === 'past_due';

  // Free users: daily digest handled separately — skip per-alert email
  // Pro users: send immediately
  if (!isPro) return;

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
