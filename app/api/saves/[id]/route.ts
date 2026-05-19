import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('saves')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const folder_id: unknown = body?.folder_id;
  if (typeof folder_id !== 'string' || !folder_id) {
    return NextResponse.json({ error: 'folder_id required' }, { status: 400 });
  }

  const { data: folder, error: folderErr } = await supabase
    .from('collection_folders')
    .select('id')
    .eq('id', folder_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (folderErr) {
    console.error('[/api/saves PATCH] folder lookup error', folderErr);
    return NextResponse.json({ error: folderErr.message }, { status: 500 });
  }
  if (!folder) return NextResponse.json({ error: 'invalid folder_id' }, { status: 400 });

  const { error } = await supabase
    .from('saves')
    .update({ folder_id })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[/api/saves PATCH] update error', error);
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
