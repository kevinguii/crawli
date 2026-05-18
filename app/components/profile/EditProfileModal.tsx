'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';

interface Props {
  profile: Profile;
  onClose: () => void;
  onSaved: () => void;
}

const MAX_NAME_LEN = 60;
const MAX_BIO_LEN = 300;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export default function EditProfileModal({ profile, onClose, onSaved }: Props) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const name = displayName.trim() || (profile.email ?? '').split('@')[0];
  const initial = (name || '?').charAt(0).toUpperCase();

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Avatar must be PNG, JPG, or WebP');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error('Avatar must be under 2 MB');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success('Avatar uploaded');
    } catch (err) {
      console.error('avatar upload failed', err);
      toast.error('Could not upload avatar. Try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          bio,
          avatar_url: avatarUrl,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'save failed');
      }
      toast.success('Profile updated');
      onSaved();
    } catch (err) {
      console.error('profile save failed', err);
      toast.error('Could not save profile. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.55)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md overflow-hidden rounded-2xl"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2 id="edit-profile-title" className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Edit profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="menu-item flex h-7 w-7 items-center justify-center rounded-md"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-semibold"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {initial}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className="text-left text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Remove photo
                </button>
              )}
              <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                PNG, JPG, or WebP · up to 2 MB
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={MAX_NAME_LEN}
              placeholder="Your name"
              className="input-base w-full rounded-lg px-3 py-2 text-sm"
            />
            <div className="mt-1 text-right text-[10px]" style={{ color: 'var(--text-dim)' }}>
              {displayName.length}/{MAX_NAME_LEN}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={MAX_BIO_LEN}
              rows={3}
              placeholder="A short description about you"
              className="input-base w-full resize-none rounded-lg px-3 py-2 text-sm"
            />
            <div className="mt-1 text-right text-[10px]" style={{ color: 'var(--text-dim)' }}>
              {bio.length}/{MAX_BIO_LEN}
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-secondary rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || uploading}
            className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
