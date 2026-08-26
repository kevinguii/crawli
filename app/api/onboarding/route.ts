// Onboarding state writes. Deliberately separate from every other route: it
// charges nothing, touches only the profiles.onboarding_* columns plus
// first_name/last_name/display_name (set once, during the flow), and is the
// single place onboarding_completed_at can be set.
//
// Does NOT consume a search credit. Nothing in the onboarding flow does:
// see the spec's cost model.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const bodySchema = z.object({
  persona: z.enum(['buyer', 'reseller']).optional(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  step: z.number().int().min(0).max(6).optional(),
  complete: z.literal(true).optional(),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const admin = createAdminClient();

  const patch: Record<string, unknown> = {};
  if (parsed.persona) patch.onboarding_persona = parsed.persona;
  if (parsed.firstName) patch.first_name = parsed.firstName;
  if (parsed.lastName) patch.last_name = parsed.lastName;
  if (parsed.step !== undefined) patch.onboarding_step = parsed.step;
  if (parsed.complete) patch.onboarding_completed_at = new Date().toISOString();

  // First write of the run stamps the start time, once. Also used below to
  // decide whether display_name needs composing from first/last on completion.
  const { data: existing } = await admin
    .from('profiles')
    .select('onboarding_started_at, display_name, first_name, last_name')
    .eq('id', user.id)
    .single();
  if (!existing?.onboarding_started_at) patch.onboarding_started_at = new Date().toISOString();

  // Give profile surfaces (sidebar, /profile) a real name to show right away
  // instead of the email fallback, without clobbering a display_name the user
  // already customized themselves.
  if (parsed.complete && !existing?.display_name) {
    const first = parsed.firstName ?? existing?.first_name;
    const last = parsed.lastName ?? existing?.last_name;
    const composed = [first, last].filter(Boolean).join(' ').trim();
    if (composed) patch.display_name = composed;
  }

  const { data, error } = await admin
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('onboarding_persona, onboarding_step, onboarding_started_at, onboarding_completed_at')
    .single();

  if (error) {
    console.error(`[onboarding] state write failed for user=${user.id}:`, error);
    return NextResponse.json({ error: 'write_failed' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    state: {
      persona: data.onboarding_persona,
      step: data.onboarding_step,
      startedAt: data.onboarding_started_at,
      completedAt: data.onboarding_completed_at,
    },
  });
}
