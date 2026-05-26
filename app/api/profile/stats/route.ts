import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [savesResult, watchlistResult, searchesResult, platformsResult] = await Promise.all([
    supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('watchlist')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('search_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('searched_at', startOfMonth.toISOString()),
    // Fetch platform column from recent saves to compute top platforms
    supabase
      .from('saves')
      .select('platform')
      .eq('user_id', user.id)
      .order('saved_at', { ascending: false })
      .limit(200),
  ]);

  // Aggregate platform counts from recent saves
  const platformCounts: Record<string, number> = {};
  for (const row of platformsResult.data ?? []) {
    if (row.platform) platformCounts[row.platform] = (platformCounts[row.platform] ?? 0) + 1;
  }
  const topPlatforms = Object.entries(platformCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([platform, count]) => ({ platform, count }));

  return NextResponse.json({
    searchesThisMonth: searchesResult.count ?? 0,
    totalSaves: savesResult.count ?? 0,
    totalWatching: watchlistResult.count ?? 0,
    topPlatforms,
  });
}
