'use client';

import { PLATFORM_NAMES } from '@/lib/types';
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
  const platformLabels = alert.platforms
    .map((p) => PLATFORM_NAMES[p] ?? p)
    .join(', ');

  return (
    <div
      className="rounded-xl p-4 flex items-start gap-4"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        opacity: alert.paused ? 0.6 : 1,
      }}
    >
      {/* Unread badge */}
      <div className="flex-shrink-0 mt-0.5">
        {alert.unread_match_count > 0 ? (
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
            style={{ background: 'var(--border)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
            {alert.query}
          </span>
          {alert.paused && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
              Paused
            </span>
          )}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {platformLabels} · every {alert.cadence_hours}h
        </div>
        <div className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
          Last checked {relativeTime(alert.last_run_at)}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => onTogglePause(alert)}
          className="text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
        >
          {alert.paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={() => onDelete(alert.id)}
          className="text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
