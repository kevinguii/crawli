// Lives OUTSIDE app/(protected)/ on purpose. Two reasons, both load-bearing:
//   1. It cannot be caught by its own gate, so the blocking redirect in
//      (protected)/layout.tsx cannot loop. Structural, not a conditional.
//   2. It renders without AppShell, so the sidebar's Search/Alerts/Saves/History
//      links are not on screen offering navigation the gate would bounce.

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { stepFromIndex, needsOnboarding } from '@/lib/onboarding';
import type { OnboardingPersona } from '@/lib/onboarding';
import OnboardingFlow from './OnboardingFlow';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ replay?: string }>;
}) {
  const { replay } = await searchParams;
  const isReplay = replay === '1';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?error=session_expired');

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_persona, onboarding_step, onboarding_completed_at')
    .eq('id', user.id)
    .single();

  // Already done and not an explicit replay? There is nothing to do here.
  if (profile && !needsOnboarding(profile) && !isReplay) redirect('/search');

  const initialStep = isReplay ? 'branch' : stepFromIndex(profile?.onboarding_step ?? 0);

  return (
    <main className="min-h-dvh" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto w-full max-w-xl px-5 py-10">
        <OnboardingFlow
          initialStep={initialStep}
          initialPersona={(profile?.onboarding_persona as OnboardingPersona | null) ?? null}
          replay={isReplay}
        />
      </div>
    </main>
  );
}
