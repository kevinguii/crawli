import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Returns the new listings found for this alert (newest first) so the UI can
// render them with ListingCard. Read-only — marking seen is a separate POST
// (../mark-seen) fired when the user actually opens the matches view.
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
    .from('alert_matches')
    .select('*')
    .eq('alert_id', id)
    .eq('user_id', user.id)
    .order('found_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
