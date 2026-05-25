import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureDefaultFolder } from '@/lib/collectionFolders';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  await ensureDefaultFolder(supabase, user.id);

  const { data, error } = await supabase
    .from('collection_folders')
    .select('id, user_id, name, description, is_default, created_at, saves(count)')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[/api/collection-folders GET] supabase error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch total saves count once so we can use it as item_count for the default folder
  // (My Collection = "all items"; we want the pill badge to reflect everything).
  const { count: totalSaves } = await supabase
    .from('saves')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const folders = (data ?? []).map((row: { id: string; user_id: string; name: string; description: string | null; is_default: boolean; created_at: string; saves: { count: number }[] | { count: number } | null }) => {
    const saves = row.saves;
    const folderCount = Array.isArray(saves) ? (saves[0]?.count ?? 0) : (saves?.count ?? 0);
    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      description: row.description,
      is_default: row.is_default,
      created_at: row.created_at,
      item_count: row.is_default ? (totalSaves ?? folderCount) : folderCount,
    };
  });

  return NextResponse.json({ folders });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const descRaw = typeof body?.description === 'string' ? body.description.trim() : '';
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ error: 'name too long' }, { status: 400 });
  if (descRaw.length > 280) return NextResponse.json({ error: 'description too long' }, { status: 400 });

  const { data: existing } = await supabase
    .from('collection_folders')
    .select('id')
    .eq('user_id', user.id)
    .ilike('name', name)
    .eq('is_default', false)
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'A collection with this name already exists' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('collection_folders')
    .insert({
      user_id: user.id,
      name,
      description: descRaw || null,
      is_default: false,
    })
    .select('id, user_id, name, description, is_default, created_at')
    .single();

  if (error) {
    console.error('[/api/collection-folders POST] supabase error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ folder: { ...data, item_count: 0 } });
}
