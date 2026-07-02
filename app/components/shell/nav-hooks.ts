'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

/**
 * Shared navigation hooks + sign-out helper, extracted from the old
 * top-right AuthButton so the desktop sidebar and the mobile drawer can both
 * reuse them. `markIntentionalSignOut` is re-exported here so the settings
 * page (which suppresses the "session expired" toast on deliberate sign-out)
 * keeps working after AuthButton is removed.
 */

// Module-level flag so both the sidebar sign-out and the settings-page sign-out
// can suppress the "session expired" toast when they call supabase.auth.signOut().
let _intentionalSignOut = false;
export function markIntentionalSignOut() { _intentionalSignOut = true; }
export function consumeIntentionalSignOut(): boolean {
  const v = _intentionalSignOut;
  _intentionalSignOut = false;
  return v;
}
export function wasIntentionalSignOut(): boolean { return _intentionalSignOut; }

/** Current Supabase auth user + initial loading state. */
export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
      },
    );
    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}

/**
 * Count of unseen notifications. Each alert run creates one notification
 * (daily, regardless of new matches), so the badge lights up when an alert has
 * run since the user last visited /alerts. Refreshes in realtime.
 */
export function useTotalUnreadAlerts(userId: string | undefined) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const load = () => {
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('seen', false)
        .then(({ count }) => setUnread(count ?? 0));
    };
    load();

    // Unique channel name per subscription avoids "cannot add callbacks after
    // subscribe()" collisions if more than one consumer mounts the hook.
    const channel = supabase
      .channel(`alert-badge-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        load,
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  return unread;
}

/** Current billing plan, or null while loading / on error. */
export function useBillingPlan(userId: string | undefined) {
  const [plan, setPlan] = useState<'free' | 'pro' | 'max' | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetch('/api/billing/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.plan) setPlan(d.plan); })
      .catch(() => {});
  }, [userId]);

  return plan;
}
