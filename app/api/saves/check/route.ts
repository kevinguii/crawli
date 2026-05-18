import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Batch-check whether URLs are saved by the current user.
// Body: { urls: string[] } — POST chosen over GET to avoid query-string length / encoding issues.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ saved_urls: [] });

  const body = await req.json().catch(() => ({}));
  const urls: string[] = Array.isArray(body?.urls) ? body.urls : [];
  if (urls.length === 0) return NextResponse.json({ saved_urls: [] });

  const { data, error } = await supabase
    .from('saves')
    .select('listing_url')
    .eq('user_id', user.id)
    .in('listing_url', urls);

  if (error) {
    console.error('[/api/saves/check POST] supabase error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved_urls: (data ?? []).map((r) => r.listing_url) });
}
