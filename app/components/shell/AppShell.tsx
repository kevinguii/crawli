'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import Wordmark from '@/app/components/landing/Wordmark';
import AppSidebar from './AppSidebar';
import {
  useAuthUser,
  useTotalUnreadAlerts,
  useBillingPlan,
  markIntentionalSignOut,
  consumeIntentionalSignOut,
} from './nav-hooks';

const COLLAPSE_KEY = 'crawli_sidebar_collapsed';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuthUser();
  const router = useRouter();
  const pathname = usePathname();
  const unread = useTotalUnreadAlerts(user?.id);
  const plan = useBillingPlan(user?.id);

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Restore persisted collapse preference. Done post-mount (not in a lazy
  // initializer) so the server-rendered markup and first client render match;
  // reading localStorage here is deliberate external-state sync.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(COLLAPSE_KEY) === '1') setCollapsed(true);
    } catch { /* ignore */ }
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Close the mobile drawer on any navigation (covers browser back/forward,
  // which don't fire our in-drawer onNavigate handlers).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  // "Session expired" toast on unexpected sign-out (not deliberate ones).
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        if (consumeIntentionalSignOut()) return;
        toast.error('Your session expired. Please sign in again.');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = useCallback(async () => {
    markIntentionalSignOut();
    const supabase = createClient();
    await supabase.auth.signOut();
    setDrawerOpen(false);
    router.push('/');
  }, [router]);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Desktop sidebar */}
      <aside
        className="sticky top-0 hidden h-screen shrink-0 lg:flex"
        style={{ borderRight: '1px solid var(--border)', background: 'var(--bg)' }}
      >
        <AppSidebar
          user={user}
          unread={unread}
          plan={plan}
          collapsed={collapsed}
          variant="desktop"
          onToggleCollapse={toggleCollapse}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div
          className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 backdrop-blur lg:hidden"
          style={{
            background: 'color-mix(in srgb, var(--bg) 80%, transparent)',
            borderBottom: '1px solid rgba(226, 75, 74, 0.22)',
          }}
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ color: 'var(--text)', border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full" style={{ background: '#E24B4A' }} />
            )}
          </button>
          <Link href="/search" className="flex items-center">
            <Wordmark size={26} />
          </Link>
          <div className="h-9 w-9" aria-hidden />
        </div>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="absolute left-0 top-0 h-full"
            style={{ background: 'var(--bg)', borderRight: '1px solid var(--border)', boxShadow: '0 0 40px rgba(0,0,0,0.3)' }}
          >
            <AppSidebar
              user={user}
              unread={unread}
              plan={plan}
              collapsed={false}
              variant="drawer"
              onToggleCollapse={toggleCollapse}
              onNavigate={() => setDrawerOpen(false)}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      )}
    </div>
  );
}
