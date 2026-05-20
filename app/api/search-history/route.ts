import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type FiltersPayload = {
  color: string | null;
  category: string | null;
  condition: string | null;
  size: string | null;
  minPrice: number | null;
  maxPrice: number | null;
};

function normalizeFilters(input: unknown): FiltersPayload {
  const f = (input ?? {}) as Partial<FiltersPayload>;
  return {
    color: f.color ?? null,
    category: f.category ?? null,
    condition: f.condition ?? null,
    size: f.size ?? null,
    minPrice: typeof f.minPrice === 'number' ? f.minPrice : null,
    maxPrice: typeof f.maxPrice === 'number' ? f.maxPrice : null,
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  const platformsIn = Array.isArray(body?.platforms) ? body.platforms : [];
  if (!query || platformsIn.length === 0) {
    return NextResponse.json({ error: 'missing query or platforms' }, { status: 400 });
  }
  const platforms = [...platformsIn].filter((p) => typeof p === 'string').sort();
  const filters = normalizeFilters(body?.filters);
  const searched_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('search_history')
    .upsert(
      { user_id: user.id, query, platforms, filters, searched_at },
      { onConflict: 'user_id,query,platforms,filters' }
    )
    .select('id, searched_at')
    .single();

  if (error) {
    console.error('[/api/search-history POST] supabase error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id, searched_at: data.searched_at });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limitRaw = Number(searchParams.get('limit') ?? '50');
  const limit = Math.max(1, Math.min(100, Number.isFinite(limitRaw) ? limitRaw : 50));

  const { data, error } = await supabase
    .from('search_history')
    .select('id, query, platforms, filters, searched_at')
    .eq('user_id', user.id)
    .order('searched_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[/api/search-history GET] supabase error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id')?.trim();

  let q = supabase.from('search_history').delete({ count: 'exact' }).eq('user_id', user.id);
  if (id) q = q.eq('id', id);
  const { error, count } = await q;
  if (error) {
    console.error('[/api/search-history DELETE] supabase error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ deleted: count ?? 0 });
}
