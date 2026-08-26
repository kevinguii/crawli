import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Marks all of the caller's notifications as seen: clears the nav bell badge.
// Fired when the user opens the alerts page (i.e. has "seen" the bell).
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('notifications')
    .update({ seen: true })
    .eq('user_id', user.id)
    .eq('seen', false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
