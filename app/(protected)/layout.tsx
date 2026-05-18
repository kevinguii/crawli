import { redirect } from 'next/navigation';
import { Toaster } from 'sonner';
import { createClient } from '@/lib/supabase/server';
import { SavesProvider } from '@/app/components/SavesProvider';
import { WatchlistProvider } from '@/app/components/WatchlistProvider';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect('/login');
  }

  return (
    <SavesProvider>
      <WatchlistProvider>
        {children}
        <Toaster position="bottom-right" theme="system" richColors closeButton />
      </WatchlistProvider>
    </SavesProvider>
  );
}
