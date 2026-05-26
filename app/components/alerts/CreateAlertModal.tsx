'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PLATFORM_NAMES } from '@/lib/types';
import { ALERT_EXCLUDED_PLATFORMS } from '@/lib/alertConstants';
import { createClient } from '@/lib/supabase/client';
import { nextAnchoredRunAt, formatNextRun } from '@/lib/alertSchedule';
import type { SavedSearch } from './SearchAlertsTab';

const ALERT_PLATFORMS = Object.entries(PLATFORM_NAMES)
  .filter(([key]) => !ALERT_EXCLUDED_PLATFORMS.has(key))
  .map(([key, name]) => ({ key, name }));

interface Props {
  onClose: () => void;
  onCreated: (alert: SavedSearch) => void;
  // Pre-filled from "Save as alert" CTA on search results
  prefill?: { query: string; platforms: string[] };
}

type Step = 'configure' | 'confirm';

export default function CreateAlertModal({ onClose, onCreated, prefill }: Props) {
  const [step, setStep] = useState<Step>('configure');
  const [query, setQuery] = useState(prefill?.query ?? '');
  const [platforms, setPlatforms] = useState<string[]>(
    prefill?.platforms?.filter((p) => !ALERT_EXCLUDED_PLATFORMS.has(p)) ?? ['grailed', 'depop', 'poshmark'],
  );
  const [cadence] = useState<24>(24);
  const [searchesRemaining, setSearchesRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [timezone] = useState<string>(
    () => (typeof window !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      : 'UTC'),
  );
  const nextRunDate = nextAnchoredRunAt(timezone, cadence);

  useEffect(() => {
    fetch('/api/billing/status')
      .then((r) => r.json())
      .then((d) => {
        setSearchesRemaining(Math.max(0, (d.cap ?? 10) - (d.used ?? 0)));
      })
      .catch(() => {});

    createClient().auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
  }, []);

  function togglePlatform(key: string) {
    setPlatforms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  }

  async function handleConfirm() {
    setSubmitting(true);
    // Optimistically decrement nav search counter — the first run is charged 1 search.
    window.dispatchEvent(new CustomEvent('crawli:search-started'));
    try {
      const res = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query,
          platforms,
          cadence_hours: cadence,
          notify_timezone: timezone,
          next_run_at: nextRunDate.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? 'Failed to create alert.');
        setSubmitting(false);
        return;
      }
      toast.success('Alert created! First search is running in the background.');
      onCreated(data as SavedSearch);
    } catch {
      toast.error('Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}
      >
        {step === 'configure' ? (
          <>
            <h2 className="text-lg font-semibold mb-5" style={{ color: 'var(--text)' }}>
              Create search alert
            </h2>

            {/* Query */}
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Search query
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Nike Dunk Low"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>

            {/* Platforms */}
            <div className="mb-4">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                Platforms
              </label>
              <div className="flex flex-wrap gap-2">
                {ALERT_PLATFORMS.map(({ key, name }) => {
                  const selected = platforms.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => togglePlatform(key)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={
                        selected
                          ? { background: 'var(--accent)', color: '#fff' }
                          : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }
                      }
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cadence */}
            <div className="mb-6">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                Check frequency
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Every 24h
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={!query.trim() || platforms.length === 0}
                className="flex-1 py-2 rounded-lg text-sm font-medium btn-primary disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
              Confirm alert
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              Review your alert before creating it.
            </p>

            {/* Summary */}
            <div
              className="rounded-xl p-4 mb-5 space-y-2 text-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Query</span>
                <span className="font-medium" style={{ color: 'var(--text)' }}>{query}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Platforms</span>
                <span style={{ color: 'var(--text)' }}>
                  {platforms.map((p) => PLATFORM_NAMES[p] ?? p).join(', ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Frequency</span>
                <span style={{ color: 'var(--text)' }}>
                  Daily at 9 AM
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>First check</span>
                <span style={{ color: 'var(--text)' }}>{formatNextRun(nextRunDate, timezone)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Timezone</span>
                <span className="text-xs" style={{ color: 'var(--text)' }}>{timezone}</span>
              </div>
            </div>

            {/* Quota warning */}
            <div
              className="rounded-xl p-4 mb-5 text-sm"
              style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}
            >
              <p style={{ color: 'var(--text)' }}>
                <strong>1 search will be used</strong> to set up this alert.
              </p>
              {searchesRemaining !== null && (
                <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                  You have {searchesRemaining} search{searchesRemaining !== 1 ? 'es' : ''} remaining this month.
                </p>
              )}
              <p className="mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                The first run finds your baseline results. You&apos;ll only be notified when <em>new</em> listings appear after that.
              </p>
            </div>

            {/* Notification delivery info */}
            {userEmail && (
              <p className="text-xs mb-5" style={{ color: 'var(--text-dim)' }}>
                You&apos;ll get a badge on the bell icon and an email to{' '}
                <strong style={{ color: 'var(--text-muted)' }}>{userEmail}</strong> when new matches appear (daily, approximately).
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('configure')}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting || searchesRemaining === 0}
                className="flex-1 py-2 rounded-lg text-sm font-medium btn-primary disabled:opacity-40"
              >
                {submitting ? 'Creating…' : 'Confirm & create'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
