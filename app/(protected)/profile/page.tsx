import { redirect } from 'next/navigation';
import ProfileHeader from '@/app/components/profile/ProfileHeader';
import ProfileDashboard from '@/app/components/profile/ProfileDashboard';
import { createClient } from '@/lib/supabase/server';

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  if (tab === 'saves') redirect('/saves');
  if (tab === 'watchlist') redirect('/watchlist');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url, bio, created_at, updated_at')
    .eq('id', user.id)
    .single();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
        <ProfileHeader
          profile={{
            id: user.id,
            email: profile?.email ?? user.email ?? null,
            display_name: profile?.display_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            bio: profile?.bio ?? null,
            created_at: profile?.created_at ?? user.created_at,
            updated_at: profile?.updated_at ?? user.created_at,
          }}
        />
        <div className="mt-8">
          <ProfileDashboard />
        </div>
    </div>
  );
}
