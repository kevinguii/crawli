import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureDefaultFolder } from '@/lib/collectionFolders';
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
    condition,
    image_url,
    seller,
    folder_id,
  } = body ?? {};

  if (!listing_url || !platform || !title) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }

  // Saves cap. Ungated before 2026-08-17 (paywall repackaging).
  //
  // Users who were already over the new cap keep every existing save and are simply
  // blocked from adding another until they are back under it — deleting data to
  // enforce a new price plan turns a pricing change into a support incident.
  // Re-saving something already saved is idempotent, not a new save, so it is
  // allowed through even at the cap.
  const { data: capProfile } = await supabase
    .from('profiles')
    .select('max_saves')
    .eq('id', user.id)
    .maybeSingle();
  const maxSaves = capProfile?.max_saves ?? TIER_CAPS.free.maxSaves;

  const { count: savedCount } = await supabase
    .from('saves')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if ((savedCount ?? 0) >= maxSaves) {
    const { data: alreadySaved } = await supabase
      .from('saves')
      .select('id, folder_id')
      .eq('user_id', user.id)
      .eq('listing_url', listing_url)
      .maybeSingle();
    if (alreadySaved) {
      return NextResponse.json({
        save_id: alreadySaved.id,
        folder_id: alreadySaved.folder_id,
        already_saved: true,
      });
    }
    return NextResponse.json(
      { error: 'saves_cap_reached', cap: maxSaves, used: savedCount ?? 0 },
      { status: 402 },
    );
  }

  let targetFolderId: string | null = null;
  if (folder_id) {
    const { data: folder } = await supabase
      .from('collection_folders')
      .select('id')
      .eq('id', folder_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!folder) return NextResponse.json({ error: 'invalid folder_id' }, { status: 400 });
    targetFolderId = folder.id;
  } else {
    targetFolderId = await ensureDefaultFolder(supabase, user.id);
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
    folder_id: targetFolderId,
  };

  const { data, error } = await supabase
    .from('saves')
    .insert(row)
    .select('id, folder_id')
    .single();

  if (error) {
    console.error('[/api/saves POST] supabase error', error);
    // Already saved — fetch existing id.
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('saves')
        .select('id, folder_id')
        .eq('user_id', user.id)
        .eq('listing_url', listing_url)
        .single();
      return NextResponse.json({
        save_id: existing?.id ?? null,
        folder_id: existing?.folder_id ?? targetFolderId,
        already_saved: true,
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ save_id: data.id, folder_id: data.folder_id });
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
  const folderIdParam = searchParams.get('folder_id')?.trim();

  let query = supabase
    .from('saves')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('saved_at', { ascending: false });

  if (search) query = query.ilike('title', `%${search}%`);
  if (platform) query = query.eq('platform', platform);

  if (folderIdParam) {
    const { data: defaultFolder } = await supabase
      .from('collection_folders')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .maybeSingle();

    // My Collection is the "all items" view — every save shows here regardless of folder_id.
    // Custom folders filter strictly by folder_id.
    if (!(defaultFolder && folderIdParam === defaultFolder.id)) {
      query = query.eq('folder_id', folderIdParam);
    }
  }

  const { data, error, count } = await query;
  if (error) {
    console.error('[/api/saves GET] supabase error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saves: data ?? [], total: count ?? 0 });
}
