'use client';

import { useState } from 'react';
import { PLATFORM_NAMES } from '@/lib/types';
import { formatNextRun } from '@/lib/alertSchedule';
import type { SavedSearch } from './SearchAlertsTab';

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  alert: SavedSearch;
  onDelete: (id: string) => void;
  onTogglePause: (alert: SavedSearch) => void;
  onMarkSeen: (id: string) => void;
}

export default function SavedSearchCard({ alert, onDelete, onTogglePause, onMarkSeen }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isInitializing = !alert.last_run_at;
  const isLive = !isInitializing && !alert.paused;

  const platformLabels = alert.platforms
    .map((p) => PLATFORM_NAMES[p] ?? p)
    .join(', ');

  const scheduleLabel =
    'Daily at 9 AM';

  const tz = alert.notify_timezone;
  const nextRunLabel =
    tz && alert.next_run_at
      ? formatNextRun(new Date(alert.next_run_at), tz)
      : null;

  return (
    <div
      className="rounded-xl p-4 flex items-start gap-4 transition-all"
      style={{
        background: 'var(--surface)',
        border: isInitializing
          ? '1px solid var(--border)'
          : isLive
          ? '1px solid color-mix(in srgb, #22c55e 35%, var(--border))'
          : '1px solid var(--border)',
        opacity: alert.paused ? 0.6 : 1,
      }}
    >
      {/* Status indicator / unread badge */}
      <div className="flex-shrink-0 mt-0.5">
        {isInitializing ? (
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ background: 'var(--surface-hover)' }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-spin"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
        ) : alert.unread_match_count > 0 ? (
          <button
            type="button"
            onClick={() => onMarkSeen(alert.id)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: '#E24B4A' }}
            title="Mark as seen"
          >
            {alert.unread_match_count > 99 ? '99+' : alert.unread_match_count}
          </button>
        ) : (
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{
              background: isLive
                ? 'color-mix(in srgb, #22c55e 18%, transparent)'
                : 'var(--border)',
            }}
            title={isLive ? 'Live, checking on schedule' : 'Paused'}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isLive ? '#22c55e' : 'var(--text-muted)'}
              strokeWidth="2"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
            {alert.query}
          </span>
          {alert.paused && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
            >
              Paused
            </span>
          )}
          {isInitializing && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium"
              style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}
            >
              Setting up…
            </span>
          )}
          {isLive && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1"
              style={{
                background: 'color-mix(in srgb, #22c55e 14%, transparent)',
                color: '#16a34a',
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: '#22c55e' }}
              />
              Live
            </span>
          )}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {platformLabels} · {scheduleLabel}
        </div>
        {isInitializing ? (
          <div className="mt-2">
            <div
              className="h-1 rounded-full overflow-hidden"
              style={{ background: 'var(--surface-hover)' }}
            >
              <div
                className="h-full rounded-full animate-pulse"
                style={{ width: '60%', background: 'var(--text-dim)', opacity: 0.5 }}
              />
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
              Running initial search to find baseline results…
            </p>
          </div>
        ) : (
          <div className="text-xs mt-1 space-y-0.5" style={{ color: 'var(--text-dim)' }}>
            <div>Last checked {relativeTime(alert.last_run_at)}</div>
            {nextRunLabel && (
              <div>
                Next check {nextRunLabel}
                {tz && <span className="ml-1" style={{ color: 'var(--text-dim)' }}>({tz})</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isInitializing && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {confirmDelete ? (
            <>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Delete?</span>
              <button
                type="button"
                onClick={() => { onDelete(alert.id); setConfirmDelete(false); }}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors font-medium text-white"
                style={{ background: '#E24B4A' }}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
              >
                No
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onTogglePause(alert)}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
                style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = alert.paused ? '#22c55e' : 'var(--text-muted)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                {alert.paused ? 'Resume' : 'Pause'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#E24B4A';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
