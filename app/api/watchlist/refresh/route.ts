import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { refreshListingViaSidecar } from '@/lib/scraper';

interface WatchlistRow {
  id: string;
  listing_url: string;
  platform: string;
}

// Env-driven so this can be tuned per host without code changes. Same shape
// as SEARCH_PLATFORM_CONCURRENCY — see SCALING.md tier matrix for recommended
// values. Default 4 preserves pre-existing behavior.
const CONCURRENCY = Math.max(
  1,
  parseInt(process.env.WATCHLIST_REFRESH_CONCURRENCY || '4', 10) || 4,
);

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: rows, error: listErr } = await supabase
    .from('watchlist')
    .select('id, listing_url, platform')
    .eq('user_id', user.id);

  if (listErr) {
    console.error('[/api/watchlist/refresh] list error', listErr);
    return new Response(JSON.stringify({ error: listErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const targets: WatchlistRow[] = rows ?? [];
  const now = new Date().toISOString();
  const userId = user.id;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      };

      send({ type: 'start', total: targets.length });

      let updated = 0;
      let failed = 0;
      let completed = 0;

      let idx = 0;
      const worker = async () => {
        while (true) {
          const i = idx++;
          if (i >= targets.length) return;
          const row = targets[i];
          try {
            const result = await refreshListingViaSidecar(row.listing_url, row.platform);
            // isGone: HTTP 404 confirmed the listing no longer exists (sold or delisted).
            // Treat as gone even though fetched signals are ambiguous — the page is definitively absent.
            const isGone = result?.isGone === true;
            if (!result || (!result.fetched && !isGone)) {
              failed += 1;
              await supabase
                .from('watchlist')
                .update({ last_checked_at: now })
                .eq('id', row.id)
                .eq('user_id', userId);
            } else {
              const { error } = await supabase
                .from('watchlist')
                .update({
                  price_current: result.price ?? null,
                  is_sold: result.isSold || isGone,
                  last_checked_at: now,
                })
                .eq('id', row.id)
                .eq('user_id', userId);
              if (error) {
                console.error('[/api/watchlist/refresh] update error', error);
                failed += 1;
              } else {
                updated += 1;
              }
            }
          } catch {
            failed += 1;
          }
          completed += 1;
          send({ type: 'progress', completed });
        }
      };

      const workers = Array.from(
        { length: Math.min(CONCURRENCY, targets.length) },
        () => worker()
      );
      await Promise.all(workers);

      const { data: fresh, error: fetchErr } = await supabase
        .from('watchlist')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchErr) {
        console.error('[/api/watchlist/refresh] re-fetch error', fetchErr);
        send({ type: 'done', updated, failed, rows: [] });
      } else {
        send({ type: 'done', updated, failed, rows: fresh ?? [] });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
