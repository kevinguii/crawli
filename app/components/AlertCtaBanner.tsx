'use client';

import Link from 'next/link';

/**
 * Results-page alert CTA.
 *
 * Replaces the old ghost "Save as alert" button that sat above the grid, styled
 * as a tertiary utility control. Two states only: either an alert already covers
 * this query (quiet confirmation) or it doesn't (primary pitch).
 */

interface Props {
  query: string;
  /** True when the user already has a saved alert for this query. */
  hasAlert: boolean;
  onCreateAlert: () => void;
}

function BellIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export default function AlertCtaBanner({ query, hasAlert, onCreateAlert }: Props) {
  if (hasAlert) {
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <span className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <BellIcon />
          You have an alert watching this search.
        </span>
        <Link
          href="/alerts"
          className="font-medium underline underline-offset-2"
          style={{ color: 'var(--accent-text)' }}
        >
          Manage alerts
        </Link>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5"
      style={{
        background: 'color-mix(in srgb, var(--accent) 9%, transparent)',
        border: '1px solid color-mix(in srgb, var(--accent) 32%, transparent)',
      }}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text)' }}>
          <span style={{ color: 'var(--accent-text)' }}><BellIcon size={15} /></span>
          Get these results without searching again
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          An alert rechecks these marketplaces daily or weekly and emails you only what is new.
          Narrow it further with size and a price range, so only listings worth buying reach your inbox.
        </p>
      </div>
      <button
        type="button"
        onClick={onCreateAlert}
        className="btn-primary flex flex-shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-transform duration-200 hover:scale-[1.04] hover:shadow-[0_0_18px_-2px_var(--accent)] active:scale-100"
      >
        <BellIcon size={15} />
        Create alert
        <span className="sr-only"> for {query}</span>
      </button>
    </div>
  );
}
