import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scrapeViaSidecar } from '@/lib/scraper';

interface WatchlistRow {
  id: string;
  listing_url: string;
  platform: string;
}

const CONCURRENCY = 4;

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: rows, error: listErr } = await supabase
    .from('watchlist')
    .select('id, listing_url, platform')
    .eq('user_id', user.id);

  if (listErr) {
    console.error('[/api/watchlist/refresh] list error', listErr);
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const targets: WatchlistRow[] = rows ?? [];
  const now = new Date().toISOString();

  type Outcome = { id: string; ok: boolean; price: number | null; isSold: boolean };

  const outcomes = await runWithConcurrency<WatchlistRow, Outcome>(
    targets,
    CONCURRENCY,
    async (row) => {
      try {
        const result = await scrapeViaSidecar(row.listing_url, row.platform);
        if (!result) return { id: row.id, ok: false, price: null, isSold: false };
        return {
          id: row.id,
          ok: true,
          price: result.price ?? null,
          isSold: !!result.isSold,
        };
      } catch {
        return { id: row.id, ok: false, price: null, isSold: false };
      }
    }
  );

  let updated = 0;
  let failed = 0;
  for (const o of outcomes) {
    if (o.ok) {
      const { error } = await supabase
        .from('watchlist')
        .update({
          price_current: o.price,
          is_sold: o.isSold,
          last_checked_at: now,
        })
        .eq('id', o.id)
        .eq('user_id', user.id);
      if (error) {
        console.error('[/api/watchlist/refresh] update error', error);
        failed += 1;
      } else {
        updated += 1;
      }
    } else {
      failed += 1;
      // Bump last_checked_at even on failure so the UI can show it was attempted.
      await supabase
        .from('watchlist')
        .update({ last_checked_at: now })
        .eq('id', o.id)
        .eq('user_id', user.id);
    }
  }

  const { data: fresh, error: fetchErr } = await supabase
    .from('watchlist')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (fetchErr) {
    console.error('[/api/watchlist/refresh] re-fetch error', fetchErr);
    return NextResponse.json({ updated, failed, rows: [] });
  }

  return NextResponse.json({ updated, failed, rows: fresh ?? [] });
}
