import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TIER_CAPS } from '@/lib/tierCaps';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    listing_url,
    platform,
    title,
    price,
    currency,
    image_url,
  } = body ?? {};

  if (!listing_url || !platform || !title) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }

  // Enforce tier-driven tracked-listings cap. Done before insert so the cap
  // error message can include the actual limit, and so an at-cap user
  // re-adding a duplicate (handled below via 23505) doesn't pay the cap.
  const { data: profile } = await supabase
    .from('profiles')
    .select('max_tracked_listings')
    .eq('id', user.id)
    .single();
  const maxTracked = profile?.max_tracked_listings ?? TIER_CAPS.free.maxTrackedListings;

  const { count: currentCount } = await supabase
    .from('watchlist')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if ((currentCount ?? 0) >= maxTracked) {
    // Allow duplicates to short-circuit to the existing row instead of 402.
    const { data: existing } = await supabase
      .from('watchlist')
      .select('id')
      .eq('user_id', user.id)
      .eq('listing_url', listing_url)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ watch_id: existing.id, already_watched: true });
    }
    return NextResponse.json(
      {
        error: 'quota_exceeded',
        message: `You've reached your ${maxTracked}-item tracked-listings limit. Upgrade or remove items to add more.`,
        cap: maxTracked,
      },
      { status: 402 },
    );
  }

  const row = {
    user_id: user.id,
    listing_url,
    platform,
    title,
    price_at_add: price ?? null,
    price_current: price ?? null,
    currency: currency ?? 'USD',
    image_url: image_url ?? null,
  };

  const { data, error } = await supabase
    .from('watchlist')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error('[/api/watchlist POST] supabase error', error);
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('watchlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('listing_url', listing_url)
        .single();
      return NextResponse.json({ watch_id: existing?.id ?? null, already_watched: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ watch_id: data.id });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'missing url' }, { status: 400 });

  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', user.id)
    .eq('listing_url', url);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim();
  const platform = searchParams.get('platform')?.trim();

  let query = supabase
    .from('watchlist')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (search) query = query.ilike('title', `%${search}%`);
  if (platform) query = query.eq('platform', platform);

  const { data, error, count } = await query;
  if (error) {
    console.error('[/api/watchlist GET] supabase error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ watchlist: data ?? [], total: count ?? 0 });
}
