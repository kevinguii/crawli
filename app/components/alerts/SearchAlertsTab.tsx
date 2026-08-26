'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { ALERT_CADENCE_PRESETS } from '@/lib/alertSchedule';
import SavedSearchCard from './SavedSearchCard';
import CreateAlertModal from './CreateAlertModal';

export interface SavedSearch {
  id: string;
  query: string;
  platforms: string[];
  filters: Record<string, unknown> | null;
  criteria: Record<string, unknown> | null;
  cadence_hours: typeof ALERT_CADENCE_PRESETS[number];
  last_run_at: string | null;
  next_run_at: string;
  unread_match_count: number;
  paused: boolean;
  created_at: string;
  notify_timezone: string | null;
}

interface BillingStatus {
  plan: 'free' | 'pro' | 'max';
  alertsCap: number;
}

export default function SearchAlertsTab({
  onCount,
  autoCreate = null,
}: {
  onCount?: (n: number) => void;
  autoCreate?: { query: string; platforms: string[] } | null;
} = {}) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingAlert, setEditingAlert] = useState<SavedSearch | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  // Prefill carried over from the results-page CTA. A ref, not state: the URL is
  // cleaned as soon as the modal opens (so a refresh doesn't reopen a dismissed
  // form), and the showCreate state change is what re-renders — the ref only has
  // to hold the value across that render, never drive one.
  const prefillRef = useRef<{ query: string; platforms: string[] } | null>(null);
  const autoCreateHandled = useRef(false);

  // Report the alert count up to the alerts tab bar (for its badge).
  useEffect(() => {
    if (!loading) onCount?.(alerts.length);
  }, [alerts.length, loading, onCount]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await fetch('/api/saved-searches');
        if (!cancelled && res.ok) setAlerts(await res.json());
      } catch {
        // Network failure or a request the browser aborted (mobile Safari does
        // this on backgrounding/navigation). Leave the list empty rather than
        // letting the rejection escape as an unhandled error; finally still
        // clears the loading state.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Pull billing so the "+ New alert" button can intercept alert-slot quota clicks.
  useEffect(() => {
    fetch('/api/billing/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setBilling({ plan: d.plan, alertsCap: d.caps?.alerts ?? 2 }); })
      .catch(() => {});
  }, []);

  // Arrived from the results-page CTA: open the create form pre-filled, but only
  // once the alerts list and billing have loaded, so the same quota gate a manual
  // click goes through still applies. Runs once — the ref survives the URL clean
  // and any re-render.
  useEffect(() => {
    if (!autoCreate || autoCreateHandled.current) return;
    if (loading || !billing) return;
    autoCreateHandled.current = true;
    // Drop the query params before opening so a refresh or back-navigation
    // doesn't reopen the form.
    router.replace('/alerts', { scroll: false });
    prefillRef.current = autoCreate;
    // Quota gate applies exactly as it would to a manual "+ New alert" click.
    if (!handleNewAlertClick()) prefillRef.current = null;
    // handleNewAlertClick is recreated every render but reads only current state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreate, loading, billing, router]);

  /** Opens the create modal, or blocks with a quota toast. Returns whether it opened. */
  function handleNewAlertClick(): boolean {
    const isFree = billing?.plan === 'free';
    const maxAlerts = billing?.alertsCap ?? 2;
    // Paused alerts don't count toward the limit — only active ones occupy a slot.
    const activeAlerts = alerts.filter((a) => !a.paused).length;

    if (activeAlerts >= maxAlerts) {
      // Pro alerts are marketed "Unlimited" (see TIER_CAPS.pro.maxSavedSearches),
      // so a paid user landing here has hit the anti-abuse backstop, not a real
      // limit — same rule as /api/search's 402: never tell a paying user to
      // "upgrade" or that they're "out" of something Pro is sold as unlimited on.
      // The server enforces this too (POST /api/saved-searches), but a paid user
      // should never even reach that generic wall — this client check is the one
      // they'll actually see, so it needs the same reassurance.
      toast.error(
        isFree
          ? `Free plan allows ${maxAlerts} active search alert${maxAlerts === 1 ? '' : 's'}. Pause or delete one, or upgrade for more.`
          : 'You have hit an unusually high number of saved alerts, so we have paused new ones as an anti-abuse check. Get in touch and we will lift it right away.',
        isFree
          ? {
              action: { label: 'Upgrade', onClick: () => { window.location.href = '/pricing?from=/alerts'; } },
              duration: 8000,
            }
          : {
              action: { label: 'Contact us', onClick: () => { window.location.href = '/settings?from=/alerts'; } },
              duration: 8000,
            },
      );
      return false;
    }

    setShowCreate(true);
    return true;
  }

  // Realtime: update cards when rows change (e.g. first run completes, unread count changes)
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      // Unique channel name per mount avoids StrictMode double-mount collisions
      channel = supabase
        .channel(`search-alerts-tab-${user.id}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'saved_searches', filter: `user_id=eq.${user.id}` },
          (payload) => {
            setAlerts((prev) =>
              prev.map((a) => (a.id === payload.new.id ? (payload.new as SavedSearch) : a)),
            );
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/saved-searches/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast.success('Alert deleted.');
    } else {
      toast.error('Failed to delete alert.');
    }
  }

  async function handleTogglePause(alert: SavedSearch) {
    const res = await fetch(`/api/saved-searches/${alert.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paused: !alert.paused }),
    });
    if (res.ok) {
      const updated = await res.json() as SavedSearch;
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.message ?? 'Failed to update alert.');
    }
  }

  function handleUpdated(updated: SavedSearch) {
    setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setEditingAlert(null);
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl animate-pulse"
            style={{ background: 'var(--surface)' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {alerts.length === 0 && (
        <div
          className="rounded-xl p-4 mb-6"
          style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            How alerts work
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            The first check runs immediately and we email you everything matching right now. After that,
            alerts recheck on your chosen schedule (as often as hourly on Pro, daily or weekly on Free)
            and you only hear from us <strong>when new listings appear</strong>.
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            You can stack conditions on one alert — search terms <strong>AND</strong> size{' '}
            <strong>AND</strong> a price range — so only listings worth buying reach your inbox.
          </p>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {alerts.length === 0
            ? 'No alerts yet. Create one to get notified when new listings match your search.'
            : `${alerts.length} alert${alerts.length > 1 ? 's' : ''}`}
        </p>
        <button
          type="button"
          onClick={handleNewAlertClick}
          className="btn-primary px-4 py-2 rounded-lg text-sm font-medium"
        >
          + New alert
        </button>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <SavedSearchCard
              key={alert.id}
              alert={alert}
              onDelete={handleDelete}
              onTogglePause={handleTogglePause}
              onEdit={(a) => setEditingAlert(a)}
              onViewMatches={(a) => router.push(`/alerts/${a.id}`)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateAlertModal
          prefill={prefillRef.current ?? undefined}
          onClose={() => { setShowCreate(false); prefillRef.current = null; }}
          onCreated={(newAlert) => {
            setAlerts((prev) => [newAlert, ...prev]);
            setShowCreate(false);
            prefillRef.current = null;
          }}
        />
      )}

      {editingAlert && (
        <CreateAlertModal
          editingAlert={editingAlert}
          onClose={() => setEditingAlert(null)}
          onCreated={() => {}}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
