'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PLATFORM_NAMES } from '@/lib/types';
import { CLOTHING_SIZE_OPTIONS, SHOE_SIZE_OPTIONS } from '@/lib/filterOptions';
import { ALERT_EXCLUDED_PLATFORMS, FREE_BASELINE_EDIT_COOLDOWN_HOURS } from '@/lib/alertConstants';
import { createClient } from '@/lib/supabase/client';
import { nextAnchoredRunAt, formatNextRun, cadenceLabel, cadenceScheduleLabel } from '@/lib/alertSchedule';
import type { SavedSearch } from './SearchAlertsTab';

const ALERT_PLATFORMS = Object.entries(PLATFORM_NAMES)
  .filter(([key]) => !ALERT_EXCLUDED_PLATFORMS.has(key))
  .map(([key, name]) => ({ key, name }));

interface Props {
  onClose: () => void;
  onCreated: (alert: SavedSearch) => void;
  // Pre-filled from "Save as alert" CTA on search results
  prefill?: { query: string; platforms: string[] };
  // When set, the modal edits this alert (PATCH) instead of creating one (POST).
  editingAlert?: SavedSearch;
  onUpdated?: (alert: SavedSearch) => void;
}

type Step = 'configure' | 'confirm' | 'reset-confirm';

function critField(criteria: Record<string, unknown> | null | undefined, key: string): string {
  const v = criteria?.[key];
  if (v == null) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

export default function CreateAlertModal({ onClose, onCreated, prefill, editingAlert, onUpdated }: Props) {
  const isEditing = !!editingAlert;
  const [step, setStep] = useState<Step>('configure');
  const [query, setQuery] = useState(editingAlert?.query ?? prefill?.query ?? '');
  const [platforms, setPlatforms] = useState<string[]>(
    editingAlert?.platforms?.filter((p) => !ALERT_EXCLUDED_PLATFORMS.has(p))
      ?? prefill?.platforms?.filter((p) => !ALERT_EXCLUDED_PLATFORMS.has(p))
      ?? ['grailed', 'mercari', 'depop'],
  );
  const [cadence, setCadence] = useState<24 | 168>(editingAlert?.cadence_hours ?? 24);
  // Optional AND-only sourcing criteria — narrows matches to size AND price<X.
  // Empty fields are omitted (no-op). critSize stores a SIZE_OPTIONS key
  // (e.g. 'l', 'm7_5'); lowercased on load so a pre-dropdown free-text value
  // like "L" still pre-selects the matching option.
  const [critSize, setCritSize] = useState(critField(editingAlert?.criteria, 'size').toLowerCase());
  const [maxPrice, setMaxPrice] = useState(critField(editingAlert?.criteria, 'maxPrice'));
  const [isPaid, setIsPaid] = useState(false);
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
        setIsPaid(d.status === 'active' || d.status === 'past_due' || (d.tier && d.tier !== 'free'));
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

  function buildCriteria(): Record<string, unknown> | undefined {
    const criteria: Record<string, unknown> = {};
    if (critSize.trim()) criteria.size = critSize.trim();
    const mp = parseFloat(maxPrice);
    if (!isNaN(mp) && mp > 0) criteria.maxPrice = mp;
    return Object.keys(criteria).length ? criteria : undefined;
  }

  // When editing, did the user change a baseline field (query/platforms/criteria)?
  // If so the edit re-runs the search to reset the baseline. This is free (no
  // search credit); free tier is rate-limited by a per-alert cooldown server-side.
  const sameJson = (a: unknown, b: unknown) =>
    JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const baselineChanged = isEditing && (
    query !== editingAlert!.query ||
    !sameJson(platforms, editingAlert!.platforms) ||
    !sameJson(buildCriteria() ?? null, editingAlert!.criteria)
  );

  async function handleConfirm() {
    setSubmitting(true);

    if (isEditing) {
      try {
        const res = await fetch(`/api/saved-searches/${editingAlert!.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            query,
            platforms,
            criteria: buildCriteria() ?? null,
            cadence_hours: cadence,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.message ?? 'Failed to update alert.');
          setSubmitting(false);
          return;
        }
        // A baseline-changing edit re-runs in the background. Alerts never
        // touch search quota, so no crawli:search-started event here.
        if (baselineChanged) {
          toast.success('Alert updated — match history cleared, re-running as a new baseline.');
        } else {
          toast.success('Alert updated.');
        }
        onUpdated?.(data as SavedSearch);
      } catch {
        toast.error('Something went wrong.');
        setSubmitting(false);
      }
      return;
    }

    try {
      const res = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query,
          platforms,
          criteria: buildCriteria(),
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
              {isEditing ? 'Edit search alert' : 'Create search alert'}
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

            {/* Sourcing criteria (optional, AND-only) */}
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Sourcing filters <span style={{ color: 'var(--text-dim)' }}>(optional)</span>
              </label>
              <p className="text-[11px] mb-2" style={{ color: 'var(--text-dim)' }}>
                Only notify when a listing matches all of these. e.g. size AND under $X.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={critSize}
                  onChange={(e) => setCritSize(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  <option value="">Any size</option>
                  <optgroup label="Clothing">
                    {CLOTHING_SIZE_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Shoes">
                    {SHOE_SIZE_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </optgroup>
                </select>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max price ($)"
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>
            </div>

            {/* Cadence */}
            <div className="mb-6">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                Check frequency
              </label>
              <div className="flex gap-2">
                {([24, 168] as const).map((h) => {
                  const selected = cadence === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setCadence(h)}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                      style={
                        selected
                          ? { background: 'var(--accent)', color: '#fff' }
                          : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }
                      }
                    >
                      {cadenceLabel(h)}
                    </button>
                  );
                })}
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
        ) : step === 'reset-confirm' ? (
          <>
            <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
              Clear match history?
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              This alert has results and history saved under its current search. Saving this
              change replaces them.
            </p>

            <div
              className="rounded-xl p-4 mb-6 text-sm"
              style={{ background: 'color-mix(in srgb, #ff4d4d 8%, transparent)', border: '1px solid color-mix(in srgb, #ff4d4d 30%, transparent)' }}
            >
              <p style={{ color: 'var(--text)' }}>
                All of this alert&apos;s saved matches and run history will be permanently deleted.
                A fresh baseline search runs immediately, and you&apos;ll only be notified about
                listings that show up <em>after</em> that.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={submitting}
                className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ background: '#ff4d4d', color: '#fff' }}
              >
                {submitting ? 'Saving…' : 'Yes, clear history & save'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
              {isEditing ? 'Confirm changes' : 'Confirm alert'}
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
              {isEditing ? 'Review your changes before saving.' : 'Review your alert before creating it.'}
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
              <div className="flex justify-between gap-4">
                <span style={{ color: 'var(--text-muted)' }}>Platforms</span>
                <span style={{ color: 'var(--text)', textAlign: 'right', wordBreak: 'break-word' }}>
                  {platforms.map((p) => PLATFORM_NAMES[p] ?? p).join(', ')}
                </span>
              </div>
              {(() => {
                const c = buildCriteria();
                if (!c) return null;
                const parts: string[] = [];
                if (c.size) {
                  const opt = [...CLOTHING_SIZE_OPTIONS, ...SHOE_SIZE_OPTIONS].find((o) => o.key === c.size);
                  parts.push(`size: ${opt?.label ?? c.size}`);
                }
                if (c.maxPrice != null) parts.push(`under $${c.maxPrice}`);
                return (
                  <div className="flex justify-between gap-3">
                    <span style={{ color: 'var(--text-muted)' }}>Filters</span>
                    <span className="text-right text-xs" style={{ color: 'var(--text)' }}>
                      {parts.join(' · ')}
                    </span>
                  </div>
                );
              })()}
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Frequency</span>
                <span style={{ color: 'var(--text)' }}>
                  {cadenceScheduleLabel(cadence)}
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

            {/* Alerts run entirely in-house (no Firecrawl-metered platforms), so
                they never consume search quota — creating, editing, and every
                scheduled run are free regardless of tier. */}
            {isEditing && baselineChanged ? (
              <div
                className="rounded-xl p-4 mb-5 text-sm"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <p style={{ color: 'var(--text)' }}>
                  Changing the query, platforms, or filters clears this alert&apos;s saved match history and starts a fresh baseline.
                </p>
                {!isPaid && (
                  <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                    On the free plan you can change a saved alert&apos;s search once every {FREE_BASELINE_EDIT_COOLDOWN_HOURS} hours.
                  </p>
                )}
                <p className="mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                  Past matches won&apos;t show anymore. The re-run finds your new baseline results — you&apos;ll only be notified when <em>new</em> listings appear after that.
                </p>
              </div>
            ) : !isEditing ? (
              <div
                className="rounded-xl p-4 mb-5 text-sm"
                style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}
              >
                <p style={{ color: 'var(--text)' }}>
                  The first run finds your baseline results. You&apos;ll only be notified when <em>new</em> listings appear after that.
                </p>
              </div>
            ) : (
              <div
                className="rounded-xl p-4 mb-5 text-sm"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <p style={{ color: 'var(--text-muted)' }}>
                  No changes to the query, platforms, or filters.
                </p>
              </div>
            )}

            {/* Notification delivery info */}
            {userEmail && (
              <p className="text-xs mb-5" style={{ color: 'var(--text-dim)' }}>
                You&apos;ll get a badge on the bell icon and an email to{' '}
                <strong style={{ color: 'var(--text-muted)' }}>{userEmail}</strong> when new matches appear ({cadenceLabel(cadence).toLowerCase()}, approximately).
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
                onClick={isEditing && baselineChanged ? () => setStep('reset-confirm') : handleConfirm}
                disabled={submitting}
                className="flex-1 py-2 rounded-lg text-sm font-medium btn-primary disabled:opacity-40"
              >
                {isEditing
                  ? (submitting ? 'Saving…' : 'Save changes')
                  : (submitting ? 'Creating…' : 'Confirm & create')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
