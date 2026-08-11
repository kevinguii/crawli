import { redirect } from 'next/navigation';
import { Toaster } from 'sonner';
import { createClient } from '@/lib/supabase/server';
import { needsOnboarding } from '@/lib/onboarding';
import { SavesProvider } from '@/app/components/SavesProvider';
import { WatchlistProvider } from '@/app/components/WatchlistProvider';
import { SearchHistoryProvider } from '@/app/components/SearchHistoryProvider';
import AppShell from '@/app/components/shell/AppShell';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect('/login?error=session_expired');
  }

  // Onboarding gate. Blocking by design: while onboarding_completed_at is null,
  // every protected route bounces here. /onboarding lives outside this layout so
  // it cannot catch itself — see app/onboarding/page.tsx.
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', data.user.id)
    .single();

  if (needsOnboarding({ onboarding_completed_at: profile?.onboarding_completed_at ?? null })) {
    redirect('/onboarding');
  }

  return (
    <SavesProvider>
      <WatchlistProvider>
        <SearchHistoryProvider>
          <AppShell>{children}</AppShell>
          <Toaster position="bottom-right" theme="system" richColors closeButton />
        </SearchHistoryProvider>
      </WatchlistProvider>
    </SavesProvider>
  );
}
