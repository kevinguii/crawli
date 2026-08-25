'use client';

import { CSSProperties, ReactNode, useState } from 'react';
import { platformColor } from './platformColors';
import PlatformBadge from './PlatformBadge';

export type CheckpointStatus = 'loading' | 'done' | 'failed';

/**
 * One line inside a row's expandable "reasoning" list. `dot` and `color` are
 * raw CSS color strings so callers can drive them from whatever semantics they
 * have (search uses fake pipeline stages, the watchlist refresh uses real
 * per-listing outcomes) without this file knowing about either.
 */
export interface ProgressDetailLine {
  text: string;
  /** Bullet color. Defaults to var(--text-dim). */
  dot?: string;
  /** Text color. Defaults to inheriting the list's var(--text-dim). */
  color?: string;
  /** Tooltip, for lines that truncate. */
  title?: string;
}

/**
 * Shared chrome for the streaming-progress panels: the card, its header with a
 * Cancel button and an N / M counter, and the per-platform rows. `SearchProgress`
 * and the watchlist refresh both render through this so the two surfaces stay
 * visually identical. Change the look here, not in either caller.
 */
export function ProgressPanel({
  title,
  counter,
  onCancel,
  showCancel = false,
  children,
}: {
  title: string;
  counter: string;
  onCancel?: () => void;
  showCancel?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {title}
        </p>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          {showCancel && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-80"
              style={{ background: 'var(--danger)' }}
            >
              Cancel
            </button>
          )}
          <p className="shrink-0 whitespace-nowrap text-xs" style={{ color: 'var(--text-dim)' }}>
            {counter}
          </p>
        </div>
      </div>

      <div className="space-y-2">{children}</div>
    </div>
  );
}

/**
 * A single platform row: status dot, platform badge, shimmer bar filled to
 * `fill` (0-1), a one-line label, and a disclosure caret revealing `details`.
 */
export function ProgressRow({
  platform,
  status,
  label,
  fill,
  details,
  errorTitle,
}: {
  platform: string;
  status: CheckpointStatus;
  label: string;
  /** 0-1. Callers pass real progress where they have it, a proxy where they don't. */
  fill: number;
  details: ProgressDetailLine[];
  /** Tooltip for the label, used to surface a long error message on hover. */
  errorTitle?: string;
}) {
  const [open, setOpen] = useState(false);

  const fillClass =
    status === 'done'
      ? 'bar-fill-done'
      : status === 'failed'
        ? 'bar-fill-failed'
        : 'bar-fill-loading';

  const color = platformColor(platform);
  const rowStyle: CSSProperties = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '0.75rem',
    // CSS vars consumed by .bar-fill-* (shimmer color) and .row-glow (ambient glow color).
    ['--row-color' as string]: color,
    ['--row-glow-color' as string]: color,
  };

  return (
    <div
      className={`rounded-xl p-3 transition-colors ${status === 'loading' ? 'row-glow' : ''}`}
      style={rowStyle}
    >
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <StatusDot status={status} color={color} />
          <PlatformBadge platform={platform} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="bar-track">
            <div className={fillClass} style={{ ['--fill' as string]: fill }} />
          </div>
          <p
            className="mt-1.5 truncate text-[11px]"
            style={{
              color: status === 'failed' ? 'var(--danger)' : 'var(--text-muted)',
            }}
            title={errorTitle}
          >
            {label}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Hide reasoning' : 'Show reasoning'}
          className="ml-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors"
          style={{ color: 'var(--text-dim)' }}
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 transition-transform"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            <path
              fillRule="evenodd"
              d="M7.05 4.05a1 1 0 0 1 1.4 0l5.3 5.3a1 1 0 0 1 0 1.4l-5.3 5.3a1 1 0 1 1-1.4-1.4l4.6-4.6-4.6-4.6a1 1 0 0 1 0-1.4z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {open && (
        <ul
          className="mt-3 space-y-1 border-t pt-3 pl-1 font-mono text-[10.5px]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
        >
          {details.map((line, i) => (
            <li
              key={`${line.text}-${i}`}
              className="flex items-center gap-2"
              style={line.color ? { color: line.color } : undefined}
            >
              <span
                className="inline-block h-1 w-1 shrink-0 rounded-full"
                style={{ background: line.dot ?? 'var(--text-dim)' }}
              />
              <span className="min-w-0 truncate" title={line.title}>
                {line.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusDot({ status, color }: { status: CheckpointStatus; color: string }) {
  if (status === 'done') {
    return (
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-white"
        style={{ background: color }}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5">
          <path
            fillRule="evenodd"
            d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 0 1 1.4-1.4L8.5 12l6.8-6.8a1 1 0 0 1 1.4 0z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-white"
        style={{ background: 'var(--danger)' }}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-2 w-2">
          <path
            fillRule="evenodd"
            d="M4.3 4.3a1 1 0 0 1 1.4 0L10 8.6l4.3-4.3a1 1 0 1 1 1.4 1.4L11.4 10l4.3 4.3a1 1 0 1 1-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 1 1-1.4-1.4L8.6 10 4.3 5.7a1 1 0 0 1 0-1.4z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }
  return (
    <span
      className="dot-loading inline-block h-2 w-2 rounded-full"
      style={{ background: color }}
    />
  );
}
