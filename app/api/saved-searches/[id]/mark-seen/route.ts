import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('saved_searches')
    .update({ unread_match_count: 0 })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also mark this alert's stored matches as seen so the in-app match view
  // reflects that the user has reviewed them.
  await supabase
    .from('alert_matches')
    .update({ seen: true })
    .eq('alert_id', id)
    .eq('user_id', user.id)
    .eq('seen', false);

  return new Response(null, { status: 204 });
}
