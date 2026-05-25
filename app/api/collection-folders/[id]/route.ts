import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const nameProvided = typeof body?.name === 'string';
  const descProvided = body?.description !== undefined;
  const name = nameProvided ? body.name.trim() : undefined;
  const descRaw = descProvided && typeof body.description === 'string' ? body.description.trim() : '';

  if (!nameProvided && !descProvided) {
    return NextResponse.json({ error: 'name or description required' }, { status: 400 });
  }
  if (nameProvided && !name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
  if (nameProvided && name.length > 60) return NextResponse.json({ error: 'name too long' }, { status: 400 });
  if (descProvided && descRaw.length > 280) return NextResponse.json({ error: 'description too long' }, { status: 400 });

  const { data: folder, error: fetchErr } = await supabase
    .from('collection_folders')
    .select('id, is_default')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!folder) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (nameProvided && folder.is_default) {
    return NextResponse.json({ error: 'cannot rename default folder' }, { status: 403 });
  }

  if (nameProvided && name) {
    const { data: existing } = await supabase
      .from('collection_folders')
      .select('id')
      .eq('user_id', user.id)
      .ilike('name', name)
      .eq('is_default', false)
      .neq('id', id)
      .limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'A collection with this name already exists' }, { status: 409 });
    }
  }

  const updates: Record<string, string | null> = {};
  if (nameProvided) updates.name = name;
  if (descProvided) updates.description = descRaw || null;

  const { error } = await supabase
    .from('collection_folders')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[/api/collection-folders PATCH] update error', error);
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cascade = searchParams.get('cascade') === 'true';

  const { data: folder, error: fetchErr } = await supabase
    .from('collection_folders')
    .select('id, is_default')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!folder) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (folder.is_default) {
    return NextResponse.json({ error: 'cannot delete default folder' }, { status: 403 });
  }

  if (cascade) {
    // Permanently delete every save inside this folder.
    const { error: savesErr } = await supabase
      .from('saves')
      .delete()
      .eq('folder_id', id)
      .eq('user_id', user.id);
    if (savesErr) {
      console.error('[/api/collection-folders DELETE cascade] saves error', savesErr);
      return NextResponse.json({ error: savesErr.message, code: savesErr.code }, { status: 500 });
    }
  }
  // Without cascade, ON DELETE SET NULL frees the items to render under My Collection
  // (since My Collection = "all items" regardless of folder_id).

  const { error } = await supabase
    .from('collection_folders')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[/api/collection-folders DELETE] error', error);
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
