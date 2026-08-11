'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import Wordmark from '@/app/components/landing/Wordmark';

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function TagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L3 3v6.59a2 2 0 0 0 .59 1.41l9.59 9.59a2 2 0 0 0 2.82 0l4.59-4.59a2 2 0 0 0 0-2.82Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 3l9 6.5" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: '/search', label: 'Search', Icon: SearchIcon },
  { href: '/alerts', label: 'Alerts', Icon: BellIcon, badge: true as const },
  { href: '/price-check', label: 'Price Check', Icon: TagIcon },
  { href: '/saves', label: 'Saves', Icon: HeartIcon },
  { href: '/search-history', label: 'History', Icon: ClockIcon },
];

export interface AppSidebarProps {
  user: User | null;
  /** Unread alert count for the Alerts badge (owned by AppShell). */
  unread: number;
  /** Billing plan (owned by AppShell); Upgrade shows only for 'free'. */
  plan: 'free' | 'pro' | 'max' | null;
  /** Icon-only rail (desktop). Ignored for the drawer variant. */
  collapsed: boolean;
  /** 'desktop' shows the collapse toggle; 'drawer' shows a close button + always expanded. */
  variant: 'desktop' | 'drawer';
  onToggleCollapse: () => void;
  onNavigate?: () => void;
  onSignOut: () => void;
}

export default function AppSidebar({
  user,
  unread,
  plan,
  collapsed,
  variant,
  onToggleCollapse,
  onNavigate,
  onSignOut,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // Drawer is always expanded; only the desktop rail can collapse.
  const isCollapsed = variant === 'desktop' && collapsed;

  useEffect(() => {
    if (!accountOpen) return;
    function onClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setAccountOpen(false); }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [accountOpen]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const initial = (user?.email ?? '?').charAt(0).toUpperCase();
  const fromParam = encodeURIComponent(pathname);

  return (
    <div
      className="flex h-full flex-col"
      style={{ width: isCollapsed ? 68 : 248, transition: 'width 180ms ease' }}
    >
      {/* Header: wordmark + collapse/close control */}
      <div className="flex items-center justify-between px-3 py-4" style={{ minHeight: 64 }}>
        {!isCollapsed && (
          <Link href="/search" onClick={onNavigate} className="flex items-center pl-1">
            <Wordmark size={26} />
          </Link>
        )}
        {variant === 'desktop' ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand' : 'Collapse'}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)', margin: isCollapsed ? '0 auto' : undefined }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none' }}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Primary nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ href, label, Icon, badge }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              title={isCollapsed ? label : undefined}
              aria-label={label}
              className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
              style={{
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                color: active ? 'var(--text)' : 'var(--text-muted)',
                background: active ? 'var(--accent-soft)' : 'transparent',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <span className="relative flex items-center justify-center" style={{ color: active ? 'var(--accent)' : 'inherit' }}>
                <Icon />
                {badge && (unread ?? 0) > 0 && isCollapsed && (
                  <span
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: '#E24B4A' }}
                  >
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </span>
              {!isCollapsed && <span className="flex-1">{label}</span>}
              {!isCollapsed && badge && (unread ?? 0) > 0 && (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white"
                  style={{ background: '#E24B4A' }}
                >
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="flex flex-col gap-1 px-3 pb-4 pt-2">
        {plan === 'free' && (
          <Link
            href={`/pricing?from=${fromParam}`}
            onClick={onNavigate}
            title={isCollapsed ? 'Upgrade' : undefined}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              background: 'var(--accent)',
              color: '#fff',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            {!isCollapsed && <span>Upgrade</span>}
          </Link>
        )}

        <Link
          href="/"
          onClick={onNavigate}
          title={isCollapsed ? 'Home' : undefined}
          aria-label="Home"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
          style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <HomeIcon />
          {!isCollapsed && <span>Home</span>}
        </Link>

        {/* Account */}
        <div ref={accountRef} className="relative mt-1" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setAccountOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            title={isCollapsed ? (user?.email ?? 'Account') : undefined}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 transition-colors"
            style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', background: accountOpen ? 'var(--surface-hover)' : 'transparent' }}
            onMouseEnter={(e) => { if (!accountOpen) e.currentTarget.style.background = 'var(--surface-hover)'; }}
            onMouseLeave={(e) => { if (!accountOpen) e.currentTarget.style.background = 'transparent'; }}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {initial}
            </span>
            {!isCollapsed && (
              <>
                <span className="min-w-0 flex-1 truncate text-left text-sm" style={{ color: 'var(--text)' }} title={user?.email ?? undefined}>
                  {user?.email ?? 'Account'}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: accountOpen ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </>
            )}
          </button>

          <div
            role="menu"
            className="absolute bottom-full left-0 mb-2 w-56 overflow-hidden rounded-lg"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
              opacity: accountOpen ? 1 : 0,
              transform: accountOpen ? 'translateY(0)' : 'translateY(4px)',
              pointerEvents: accountOpen ? 'auto' : 'none',
              transition: 'opacity 160ms ease, transform 160ms ease',
            }}
          >
            <Link href="/profile" onClick={() => { setAccountOpen(false); onNavigate?.(); }} className="menu-item block w-full px-3 py-2.5 text-left text-sm">
              Profile
            </Link>
            <Link href="/settings" onClick={() => { setAccountOpen(false); onNavigate?.(); }} className="menu-item block w-full px-3 py-2.5 text-left text-sm">
              Settings
            </Link>
            <Link href={`/pricing?from=${fromParam}`} onClick={() => { setAccountOpen(false); onNavigate?.(); }} className="menu-item block w-full px-3 py-2.5 text-left text-sm">
              Pricing
            </Link>
            <button
              type="button"
              onClick={() => { setAccountOpen(false); onSignOut(); }}
              className="menu-item w-full px-3 py-2.5 text-left text-sm"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
