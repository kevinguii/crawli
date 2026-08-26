'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PLATFORM_NAMES } from '@/lib/types';
import { CLOTHING_SIZE_OPTIONS, SHOE_SIZE_OPTIONS } from '@/lib/filterOptions';
import { ALERT_EXCLUDED_PLATFORMS, FREE_BASELINE_EDIT_COOLDOWN_HOURS, findAlertQueryProblem } from '@/lib/alertConstants';
import { createClient } from '@/lib/supabase/client';
import { nextAnchoredRunAt, formatNextRun, cadenceLabel, cadenceScheduleLabel, ALERT_CADENCE_PRESETS, isCadenceAllowed } from '@/lib/alertSchedule';
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
  const [cadence, setCadence] = useState<typeof ALERT_CADENCE_PRESETS[number]>(
    editingAlert?.cadence_hours ?? 24,
  );
  // Optional AND-only sourcing criteria — narrows matches to size AND price<X.
  // Empty fields are omitted (no-op). critSize stores a SIZE_OPTIONS key
  // (e.g. 'l', 'm7_5'); lowercased on load so a pre-dropdown free-text value
  // like "L" still pre-selects the matching option.
  const [critSize, setCritSize] = useState(critField(editingAlert?.criteria, 'size').toLowerCase());
  const [minPrice, setMinPrice] = useState(critField(editingAlert?.criteria, 'minPrice'));
  const [maxPrice, setMaxPrice] = useState(critField(editingAlert?.criteria, 'maxPrice'));
  const [isPaid, setIsPaid] = useState(false);
  // Strictest floor until billing answers, relaxed once /api/billing/status responds.
  const [minCadence, setMinCadence] = useState(168);
  const [submitting, setSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [timezone] = useState<string>(
    () => (typeof window !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      : 'UTC'),
  );
  // Whether the currently-selected cadence is actually usable on this
  // account's tier. Replaces the old two-value mayPickDaily/effectiveCadence
  // pair: with 6 presets, "clamp 24 up to 168" doesn't generalize, but "clamp
  // up to the floor itself" does, because the floor is always one of the
  // legal presets (24 for free, 1 for paid).
  const effectiveCadence: typeof ALERT_CADENCE_PRESETS[number] =
    editingAlert || isCadenceAllowed(cadence, minCadence) ? cadence : (minCadence as typeof ALERT_CADENCE_PRESETS[number]);

  const nextRunDate = nextAnchoredRunAt(timezone, effectiveCadence);

  useEffect(() => {
    fetch('/api/billing/status')
      .then((r) => r.json())
      .then((d) => {
        const paid = d.status === 'active' || d.status === 'past_due' || (d.tier && d.tier !== 'free');
        setIsPaid(paid);
        if (typeof d?.caps?.minAlertCadenceHours === 'number') setMinCadence(d.caps.minAlertCadenceHours);
        // Only a NEW alert's default moves to hourly — an alert being edited
        // keeps whatever cadence it already has, per the spec's requirement
        // that editing never force-changes a stored value.
        if (!editingAlert && paid) setCadence(1);
      })
      .catch(() => {});

    createClient().auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
    // editingAlert is stable for the lifetime of this component (the modal is
    // unmounted/remounted between create and edit, never handed a new alert
    // in place), so listing it here does not change when this effect runs.
  }, [editingAlert]);

  function togglePlatform(key: string) {
    setPlatforms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  }

  function buildCriteria(): Record<string, unknown> | undefined {
    const criteria: Record<string, unknown> = {};
    if (critSize.trim()) criteria.size = critSize.trim();
    const lo = parseFloat(minPrice);
    if (!isNaN(lo) && lo > 0) criteria.minPrice = lo;
    const hi = parseFloat(maxPrice);
    if (!isNaN(hi) && hi > 0) criteria.maxPrice = hi;
    return Object.keys(criteria).length ? criteria : undefined;
  }

  // Plain-English rendering of the full AND-chain, so the compound nature of an
  // alert is visible while it's being built rather than only in the summary step.
  // An alert watches one thing. A query containing list separators can never
  // match anything (see findAlertQueryProblem), so it is blocked at the input
  // rather than silently accepted and quietly returning nothing forever.
  const queryProblem = findAlertQueryProblem(query);

  // The query is the first condition — criteria narrow it, they don't replace it.
  function criteriaClauses(): string[] {
    const clauses: string[] = [];
    const c = buildCriteria() ?? {};
    if (c.size) {
      const opt = [...CLOTHING_SIZE_OPTIONS, ...SHOE_SIZE_OPTIONS].find((o) => o.key === c.size);
      clauses.push(`size ${opt?.label ?? c.size}`);
    }
    if (c.minPrice != null && c.maxPrice != null) clauses.push(`$${c.minPrice} to $${c.maxPrice}`);
    else if (c.maxPrice != null) clauses.push(`under $${c.maxPrice}`);
    else if (c.minPrice != null) clauses.push(`over $${c.minPrice}`);
    return clauses;
  }

  const clauses = criteriaClauses();
  const priceRangeInvalid = (() => {
    const lo = parseFloat(minPrice);
    const hi = parseFloat(maxPrice);
    return !isNaN(lo) && !isNaN(hi) && lo > 0 && hi > 0 && lo > hi;
  })();

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
            cadence_hours: effectiveCadence,
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
          cadence_hours: effectiveCadence,
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
      toast.success(
        'Alert created — we’re running the first search now and will email you an initial batch of results shortly.',
        { duration: 7000 },
      );
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
              {queryProblem && (
                <p
                  className="mt-1.5 text-xs"
                  role="alert"
                  style={{ color: 'var(--danger, #dc2626)' }}
                >
                  No symbols like{' '}
                  {queryProblem.separators.map((c) => `"${c}"`).join(' or ')} in an
                  alert. Use plain words only.
                </p>
              )}
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

            {/* Sourcing criteria (optional, AND-only). Given its own bordered
                block and a live plain-English readout because this compound
                matching is the one alert capability the browser extensions
                don't have, and it was previously easy to scroll straight past. */}
            <div
              className="mb-4 rounded-xl p-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>
                Narrow it down <span style={{ color: 'var(--text-dim)' }}>(optional)</span>
              </label>
              <p className="text-[11px] mb-2.5" style={{ color: 'var(--text-muted)' }}>
                Stack conditions and only hear about listings that match <strong>all</strong> of them.
                Your search terms already carry the brand and keywords.
              </p>

              <select
                value={critSize}
                onChange={(e) => setCritSize(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)' }}
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

              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Min $"
                  aria-label="Minimum price"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
                <span className="text-xs" style={{ color: 'var(--text-dim)' }}>to</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max $"
                  aria-label="Maximum price"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>

              {priceRangeInvalid ? (
                <p className="mt-2 text-[11px]" style={{ color: 'var(--danger)' }}>
                  Min price is above max price — nothing can match both.
                </p>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                  Alert me when a listing matches{' '}
                  <span style={{ color: 'var(--text-muted)' }}>
                    {query.trim() ? `“${query.trim()}”` : 'your search'}
                  </span>
                  {clauses.map((c) => (
                    <span key={c}>
                      {' '}<span style={{ color: 'var(--text-dim)' }}>AND</span>{' '}
                      <span style={{ color: 'var(--text-muted)' }}>{c}</span>
                    </span>
                  ))}
                  {clauses.length === 0 && ' — add a size or price to narrow it further.'}
                </p>
              )}
            </div>

            {/* Cadence */}
            <div className="mb-6">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                Check frequency
              </label>
              <div className="flex flex-wrap gap-2">
                {ALERT_CADENCE_PRESETS.map((h) => {
                  const selected = effectiveCadence === h;
                  // Rendered disabled rather than hidden: a locked option the
                  // user can see is the upgrade prompt. Hiding it just makes
                  // the free plan look like the whole product. Mirrors the
                  // server exactly: PATCH only re-checks the floor when
                  // cadence actually changes, so an alert already on a faster
                  // cadence stays togglable for its owner even if the account
                  // is later downgraded.
                  const gated = !isCadenceAllowed(h, minCadence) && h !== editingAlert?.cadence_hours;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => { if (!gated) setCadence(h); }}
                      disabled={gated}
                      title={gated ? `${cadenceLabel(h)} is part of Pro` : undefined}
                      className="flex-1 min-w-[5.5rem] py-2 rounded-lg text-sm font-medium transition-all"
                      style={
                        selected
                          ? { background: 'var(--accent)', color: '#fff' }
                          : {
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-muted)',
                              opacity: gated ? 0.55 : 1,
                              cursor: gated ? 'not-allowed' : 'pointer',
                            }
                      }
                    >
                      {cadenceLabel(h)}
                      {gated && ' · Pro'}
                    </button>
                  );
                })}
              </div>
              {!editingAlert && minCadence >= 24 && (
                <p className="mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                  Free alerts check {cadenceLabel(minCadence).toLowerCase()}.{' '}
                  <a href="/pricing" className="underline" style={{ color: 'var(--text-muted)' }}>
                    Pro checks as often as hourly
                  </a>
                  .
                </p>
              )}
              {!editingAlert && minCadence < 24 && !isPaid && (
                <p className="mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                  Free includes 1 alert.{' '}
                  <a href="/pricing" className="underline" style={{ color: 'var(--text-muted)' }}>
                    Pro gives you unlimited
                  </a>
                  .
                </p>
              )}
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
                disabled={!query.trim() || platforms.length === 0 || priceRangeInvalid || queryProblem !== null}
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
              {clauses.length > 0 && (
                <div className="flex justify-between gap-3">
                  <span style={{ color: 'var(--text-muted)' }}>Must also match</span>
                  <span className="text-right text-xs" style={{ color: 'var(--text)' }}>
                    {clauses.join(' AND ')}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Frequency</span>
                <span style={{ color: 'var(--text)' }}>
                  {cadenceScheduleLabel(effectiveCadence)}
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
                  Past matches won&apos;t show anymore. The re-run emails you the new baseline — everything matching the changed search right now — and after that you&apos;ll only hear about <em>new</em> listings.
                </p>
              </div>
            ) : !isEditing ? (
              <div
                className="rounded-xl p-4 mb-5 text-sm"
                style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}
              >
                <p style={{ color: 'var(--text)' }}>
                  The first check runs straight away and we&apos;ll email you everything matching right now.
                  After that you&apos;ll only hear about <em>new</em> listings.
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
                <strong style={{ color: 'var(--text-muted)' }}>{userEmail}</strong> when new matches appear ({cadenceLabel(effectiveCadence).toLowerCase()}, approximately).
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
