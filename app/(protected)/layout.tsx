import { redirect } from 'next/navigation';
import { Toaster } from 'sonner';
import { createClient } from '@/lib/supabase/server';
import { SavesProvider } from '@/app/components/SavesProvider';

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
      {children}
      <Toaster position="bottom-right" theme="system" richColors closeButton />
    </SavesProvider>
  );
}
