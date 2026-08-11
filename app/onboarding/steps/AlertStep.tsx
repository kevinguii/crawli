'use client';

import { useState } from 'react';
import type { StepProps } from '../OnboardingFlow';

const ALERT_PLATFORMS = [
  'grailed',
  'depop',
  'poshmark',
  'mercari',
  'vinted',
  'thredup',
  'vestiaire',
  'stockx',
];

export default function AlertStep({ draft, patch, advance, busy }: StepProps) {
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function createAlert() {
    setCreating(true);
    setFailed(null);
    try {
      const res = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: draft.query.trim(),
          platforms: ALERT_PLATFORMS,
          criteria: {
            size: draft.size,
            minPrice: draft.minPrice,
            maxPrice: draft.maxPrice,
          },
          cadence_hours: 24,
          notify_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (res.ok) {
        patch({ alertCreated: true });
      } else {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        // quota_exceeded is a legitimate outcome for a user who already has 2
        // alerts (free cap) — it is not a failure of the flow.
        setFailed(body?.error === 'quota_exceeded'
          ? "You are already at your alert limit, so we did not add another."
          : 'We could not set that up just now.');
      }
    } catch {
      setFailed('We could not set that up just now.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        {draft.alertCreated ? 'Your alert is live' : 'Get told when one shows up'}
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        {draft.alertCreated
          ? 'We check every morning and email you when something new matches. Check your inbox now for what matches today.'
          : 'We check 8 marketplaces every morning and email you when something new matches.'}
      </p>

      <div
        className="mt-6 rounded-2xl px-4 py-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {draft.query}
        </span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {draft.size && <Chip>size {draft.size}</Chip>}
          {draft.minPrice !== null && <Chip>min ${draft.minPrice}</Chip>}
          {draft.maxPrice !== null && <Chip>max ${draft.maxPrice}</Chip>}
        </div>
      </div>

      {failed && (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-dim)' }}>
          {failed} You can carry on.
        </p>
      )}

      {!draft.alertCreated ? (
        <button
          type="button"
          disabled={creating || busy}
          onClick={createAlert}
          className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {creating ? 'Setting it up…' : 'Create this alert'}
        </button>
      ) : null}

      {/* Always available, even if creation failed: the flow is blocking and must
          never dead-end on an upstream error. */}
      <button
        type="button"
        disabled={busy || creating}
        onClick={advance}
        className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50"
        style={{
          background: draft.alertCreated ? 'var(--accent)' : 'transparent',
          border: draft.alertCreated ? 'none' : '1px solid var(--border)',
          color: draft.alertCreated ? '#fff' : 'var(--text-dim)',
        }}
      >
        {busy ? 'Saving…' : draft.alertCreated ? 'Continue' : 'Skip for now'}
      </button>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px]"
      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}
    >
      {children}
    </span>
  );
}
