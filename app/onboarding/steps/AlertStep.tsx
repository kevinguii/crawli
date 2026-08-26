'use client';

import { useState } from 'react';
import type { StepProps } from '../OnboardingFlow';
import { CLOTHING_SIZE_OPTIONS, SHOE_SIZE_OPTIONS } from '@/lib/filterOptions';
import StepButton from './StepButton';

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

  const sizeLabel = draft.size
    ? [...CLOTHING_SIZE_OPTIONS, ...SHOE_SIZE_OPTIONS].find((o) => o.key === draft.size)?.label ?? draft.size
    : null;

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
        // alerts (free cap). It is not a failure of the flow.
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
        {draft.alertCreated ? 'Your alert is live' : 'Set up an alert'}
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        {draft.alertCreated
          ? "We're running your first search now. Check your inbox in a few minutes for what matches today. After that, we check every morning and email you when something new shows up."
          : 'We check 8 of them every morning (eBay is search-only) and email you when something new matches.'}
      </p>

      {draft.alertCreated && (
        <p className="mt-2 text-xs" style={{ color: 'var(--text-dim)' }}>
          You can find this alert, edit its criteria, or create more from the Alerts tab.
        </p>
      )}

      <div
        className="mt-6 rounded-2xl px-4 py-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          {draft.query}
        </span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {sizeLabel && <Chip>size {sizeLabel}</Chip>}
          {draft.minPrice !== null && <Chip>min ${draft.minPrice}</Chip>}
          {draft.maxPrice !== null && <Chip>max ${draft.maxPrice}</Chip>}
        </div>
      </div>

      {failed && (
        <p className="mt-3 text-xs" aria-live="polite" style={{ color: 'var(--text-dim)' }}>
          {failed} You can carry on.
        </p>
      )}

      {!draft.alertCreated ? (
        <StepButton onClick={createAlert} disabled={creating || busy}>
          {creating ? 'Setting it up…' : 'Create this alert'}
        </StepButton>
      ) : null}

      {/* Always available, even if creation failed: the flow is blocking and must
          never dead-end on an upstream error. */}
      <StepButton
        onClick={advance}
        disabled={busy || creating}
        variant={draft.alertCreated ? 'primary' : 'secondary'}
        className="mt-3"
      >
        {busy ? 'Saving…' : draft.alertCreated ? 'Continue' : 'Skip for now'}
      </StepButton>
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
