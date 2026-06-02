'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import SubscriptionBadge from './SubscriptionBadge';

function useTotalUnreadAlerts(userId: string | undefined) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    // Initial load
    supabase
      .from('saved_searches')
      .select('unread_match_count')
      .eq('user_id', userId)
      .then(({ data }) => {
        const total = (data ?? []).reduce((s, r) => s + (r.unread_match_count ?? 0), 0);
        setUnread(total);
      });

    // Realtime: update badge whenever any saved_search row changes for this user
    const channel = supabase
      .channel('alert-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'saved_searches', filter: `user_id=eq.${userId}` },
        () => {
          supabase
            .from('saved_searches')
            .select('unread_match_count')
            .eq('user_id', userId)
            .then(({ data }) => {
              const total = (data ?? []).reduce((s, r) => s + (r.unread_match_count ?? 0), 0);
              setUnread(total);
            });
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  return unread;
}

// Module-level flag so the settings page sign-out (a separate component) can
// also suppress the "session expired" toast when it calls supabase.auth.signOut().
export function markIntentionalSignOut() { _intentionalSignOut = true; }
let _intentionalSignOut = false;

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' && !_intentionalSignOut) {
          toast.error('Your session expired. Please sign in again.');
        }
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    markIntentionalSignOut();
    const supabase = createClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push('/');
  }

  const unreadAlerts = useTotalUnreadAlerts(user?.id);

  if (loading) {
    return (
      <div
        className="h-9 w-20 rounded-lg transition-opacity duration-200"
        style={{ background: 'var(--surface)', opacity: 0.6 }}
        aria-hidden
      />
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="btn-primary inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium"
      >
        Sign in
      </Link>
    );
  }

  const initial = (user.email ?? '?').charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <SubscriptionBadge />
      <Link
        href="/alerts"
        aria-label="Alerts"
        title="Alerts"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.opacity = '0.8'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.opacity = '1'; }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadAlerts > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: '#E24B4A' }}
          >
            {unreadAlerts > 9 ? '9+' : unreadAlerts}
          </span>
        )}
      </Link>
      <Link
        href="/saves"
        aria-label="Saves"
        title="Saves"
        className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.opacity = '0.8'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.opacity = '1'; }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </Link>
      <div ref={menuRef} className="relative">
        <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 transition-all duration-200"
        style={{
          background: menuOpen ? 'var(--surface-hover)' : 'var(--surface)',
          border: '1px solid var(--border)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.opacity = '0.8'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.opacity = '1'; }}
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
          style={{ background: 'var(--accent)', color: '#ffffff' }}
        >
          {initial}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease',
          }}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        role="menu"
        className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-lg"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-strong)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
          opacity: menuOpen ? 1 : 0,
          transform: menuOpen ? 'translateY(0)' : 'translateY(-4px)',
          pointerEvents: menuOpen ? 'auto' : 'none',
          transition: 'opacity 180ms ease, transform 180ms ease',
        }}
      >
        <div className="px-3 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
            Signed in as
          </div>
          <div
            className="text-sm font-medium truncate"
            style={{ color: 'var(--text)' }}
            title={user.email ?? undefined}
          >
            {user.email}
          </div>
        </div>
        <Link
          href="/profile"
          onClick={() => setMenuOpen(false)}
          className="menu-item block w-full text-left px-3 py-2.5 text-sm"
        >
          Profile
        </Link>
        <Link
          href="/settings"
          onClick={() => setMenuOpen(false)}
          className="menu-item block w-full text-left px-3 py-2.5 text-sm"
        >
          Settings
        </Link>
        <Link
          href="/pricing"
          onClick={() => setMenuOpen(false)}
          className="menu-item block w-full text-left px-3 py-2.5 text-sm"
        >
          Pricing
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="menu-item w-full text-left px-3 py-2.5 text-sm"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          Sign out
        </button>
      </div>
      </div>
    </div>
  );
}
