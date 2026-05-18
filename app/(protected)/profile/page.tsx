import { redirect } from 'next/navigation';
import Link from 'next/link';
import ThemeToggle from '@/app/components/ThemeToggle';
import AuthButton from '@/app/components/AuthButton';
import ProfileHeader from '@/app/components/profile/ProfileHeader';
import ProfileTabsClient from '@/app/components/profile/ProfileTabsClient';
import { createClient } from '@/lib/supabase/server';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, display_name, avatar_url, bio, created_at, updated_at')
    .eq('id', user.id)
    .single();

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <nav
        className="sticky top-0 z-20 backdrop-blur"
        style={{
          background: 'color-mix(in srgb, var(--bg) 80%, transparent)',
          borderBottom: '1px solid rgba(226, 75, 74, 0.22)',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center">
            <span
              style={{
                fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
                fontSize: '30px',
                fontWeight: 700,
                letterSpacing: '-0.5px',
                background:
                  'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27, #FAC775)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                lineHeight: 1.2,
              }}
            >
              Crawli
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </nav>

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
          <ProfileTabsClient />
        </div>
      </div>
    </main>
  );
}
