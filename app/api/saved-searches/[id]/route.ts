import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const patchSchema = z.object({
  query: z.string().min(1).max(200),
  platforms: z.array(z.string()).min(1),
  filters: z.record(z.string(), z.unknown()).nullable(),
  cadence_hours: z.literal(24),
  paused: z.boolean(),
}).partial();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
  }

  // Block unpause if it would push the user over their active-alert cap.
  if (parsed.data.paused === false) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('max_saved_searches')
      .eq('id', user.id)
      .single();
    const maxAlerts = profile?.max_saved_searches ?? 1;

    const { count } = await supabase
      .from('saved_searches')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('paused', false);

    if ((count ?? 0) >= maxAlerts) {
      return NextResponse.json(
        {
          error: 'quota_exceeded',
          message: `You've reached your limit of ${maxAlerts} active alert${maxAlerts === 1 ? '' : 's'}. Pause or delete another alert first.`,
        },
        { status: 402 },
      );
    }
  }

  const { data, error } = await supabase
    .from('saved_searches')
    .update(parsed.data)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
