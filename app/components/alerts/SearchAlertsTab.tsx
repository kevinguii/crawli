'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import SavedSearchCard from './SavedSearchCard';
import CreateAlertModal from './CreateAlertModal';

export interface SavedSearch {
  id: string;
  query: string;
  platforms: string[];
  filters: Record<string, unknown> | null;
  criteria: Record<string, unknown> | null;
  cadence_hours: 24;
  last_run_at: string | null;
  next_run_at: string;
  unread_match_count: number;
  paused: boolean;
  created_at: string;
  notify_timezone: string | null;
}

interface BillingStatus {
  plan: 'free' | 'pro' | 'max';
  used: number;
  cap: number;
  alertsCap: number;
}

export default function SearchAlertsTab() {
  const [alerts, setAlerts] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      setLoading(true);
      try {
        const res = await fetch('/api/saved-searches');
        if (!cancelled && res.ok) setAlerts(await res.json());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Pull billing so the "+ New alert" button can intercept quota-exceeded clicks.
  useEffect(() => {
    fetch('/api/billing/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setBilling({ plan: d.plan, used: d.used, cap: d.cap, alertsCap: d.caps?.alerts ?? 2 }); })
      .catch(() => {});
  }, []);

  function handleNewAlertClick() {
    const isFree = billing?.plan === 'free';
    const maxAlerts = billing?.alertsCap ?? 2;
    // Paused alerts don't count toward the limit — only active ones occupy a slot.
    const activeAlerts = alerts.filter((a) => !a.paused).length;

    // Check alert quota first — more specific reason than search quota.
    if (activeAlerts >= maxAlerts) {
      toast.error(
        isFree
          ? `Free plan allows ${maxAlerts} active search alert${maxAlerts === 1 ? '' : 's'}. Pause or delete one, or upgrade for more.`
          : `You've reached your limit of ${maxAlerts} active alerts. Pause or delete one to create a new one.`,
        isFree
          ? {
              action: { label: 'Upgrade', onClick: () => { window.location.href = '/pricing?from=/alerts'; } },
              duration: 8000,
            }
          : { duration: 6000 },
      );
      return;
    }

    // Then search quota (creation costs 1 search).
    if (billing && billing.used >= billing.cap) {
      toast.error(
        `You've used all ${billing.cap} searches for this period. Creating a search alert uses 1 search.`,
        {
          action: { label: 'Upgrade', onClick: () => { window.location.href = '/pricing'; } },
          duration: 8000,
        },
      );
      return;
    }

    setShowCreate(true);
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

  async function handleMarkSeen(id: string) {
    await fetch(`/api/saved-searches/${id}/mark-seen`, { method: 'POST' });
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, unread_match_count: 0 } : a)),
    );
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
            Alerts check daily at 9 AM in your timezone. You'll receive an email <strong>only when new listings are found</strong>. The first check establishes your baseline — no email then.
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
              onMarkSeen={handleMarkSeen}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateAlertModal
          onClose={() => setShowCreate(false)}
          onCreated={(newAlert) => {
            setAlerts((prev) => [newAlert, ...prev]);
            setBilling((b) => (b ? { ...b, used: b.used + 1 } : b));
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
