import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Returns one row per alert run (newest first), independent of the
// alert_matches 100-row cap, so the UI can render a day-by-day history even
// for days whose matches have since been pruned.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // RLS restricts to the caller's own rows; the user_id filter is belt-and-braces.
  const { data, error } = await supabase
    .from('notifications')
    .select('id, new_count, created_at')
    .eq('alert_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(365);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
