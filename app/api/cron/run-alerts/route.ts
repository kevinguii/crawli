import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runAlert, SavedSearch } from '@/lib/alertRunner';

export const dynamic = 'force-dynamic';
// Allow up to 5 minutes: alert runs do real searches which take 30-60s each
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/run-alerts] CRON_SECRET not set');
    return NextResponse.json({ error: 'not configured' }, { status: 500 });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Process up to 20 due alerts per tick to avoid overloading the sidecar
  const { data: due, error } = await admin
    .from('saved_searches')
    .select('*')
    .lte('next_run_at', new Date().toISOString())
    .eq('paused', false)
    .limit(20);

  if (error) {
    console.error('[cron/run-alerts] query failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ ran: 0 });
  }

  console.log(`[cron/run-alerts] processing ${due.length} alerts`);

  // Run sequentially to avoid overwhelming the sidecar with concurrent alert searches
  let totalNew = 0;
  for (const row of due) {
    try {
      const newMatches = await runAlert(row as SavedSearch);
      totalNew += newMatches;
    } catch (err) {
      console.error(`[cron/run-alerts] alert=${row.id} failed:`, err);
    }
  }

  console.log(`[cron/run-alerts] done. alerts=${due.length} new_matches=${totalNew}`);
  return NextResponse.json({ ran: due.length, new_matches: totalNew });
}
