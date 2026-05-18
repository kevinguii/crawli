import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    condition,
    image_url,
    seller,
  } = body ?? {};

  if (!listing_url || !platform || !title) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }

  const row = {
    user_id: user.id,
    listing_url,
    platform,
    title,
    price: price ?? null,
    currency: currency ?? 'USD',
    condition: condition ?? null,
    image_url: image_url ?? null,
    seller: seller ?? null,
  };

  const { data, error } = await supabase
    .from('saves')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error('[/api/saves POST] supabase error', error);
    // Already saved — fetch existing id.
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('saves')
        .select('id')
        .eq('user_id', user.id)
        .eq('listing_url', listing_url)
        .single();
      return NextResponse.json({ save_id: existing?.id ?? null, already_saved: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ save_id: data.id });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'missing url' }, { status: 400 });

  const { error } = await supabase
    .from('saves')
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
    .from('saves')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('saved_at', { ascending: false });

  if (search) query = query.ilike('title', `%${search}%`);
  if (platform) query = query.eq('platform', platform);

  const { data, error, count } = await query;
  if (error) {
    console.error('[/api/saves GET] supabase error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saves: data ?? [], total: count ?? 0 });
}
