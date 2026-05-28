import { redirect } from 'next/navigation';
import { Toaster } from 'sonner';
import { createClient } from '@/lib/supabase/server';
import { SavesProvider } from '@/app/components/SavesProvider';
import { WatchlistProvider } from '@/app/components/WatchlistProvider';
import { SearchHistoryProvider } from '@/app/components/SearchHistoryProvider';

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

  return (
    <SavesProvider>
      <WatchlistProvider>
        <SearchHistoryProvider>
          {children}
          <Toaster position="bottom-right" theme="system" richColors closeButton />
        </SearchHistoryProvider>
      </WatchlistProvider>
    </SavesProvider>
  );
}
