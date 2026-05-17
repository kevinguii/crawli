'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

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
      (_event, session) => {
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
    const supabase = createClient();
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.refresh();
  }

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
        <button
          type="button"
          onClick={handleSignOut}
          className="menu-item w-full text-left px-3 py-2.5 text-sm"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
