'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import EditProfileModal from './EditProfileModal';
import type { Profile } from '@/lib/types';

interface Props {
  profile: Profile;
}

function formatJoined(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function ProfileHeader({ profile }: Props) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  const name = profile.display_name?.trim() || (profile.email ?? '').split('@')[0];
  const initial = (name || '?').charAt(0).toUpperCase();

  const handleSaved = () => {
    setEditing(false);
    router.refresh();
  };

  return (
    <>
      <section
        className="flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-start sm:gap-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={name}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1
            className="truncate text-2xl font-semibold tracking-tight"
            style={{ color: 'var(--text)' }}
          >
            {name}
          </h1>
          <p className="truncate text-sm" style={{ color: 'var(--text-muted)' }}>
            {profile.email}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-dim)' }}>
            Joined {formatJoined(profile.created_at)}
          </p>
          {profile.bio && (
            <p
              className="mt-3 whitespace-pre-wrap text-sm leading-relaxed"
              style={{ color: 'var(--text)' }}
            >
              {profile.bio}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="btn-secondary inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg px-3 py-1.5 text-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit profile
        </button>
      </section>

      {editing && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
