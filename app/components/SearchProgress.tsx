'use client';

import { CSSProperties, useEffect, useRef, useState } from 'react';
import { platformColor } from './platformColors';
import PlatformBadge from './PlatformBadge';

export type CheckpointStatus = 'loading' | 'done' | 'failed';

interface Props {
  platforms: string[];
  statuses: Record<string, CheckpointStatus>;
  errors: Record<string, string>;
  counts?: Record<string, number>;
}

const STAGES = [
  'Submitting search…',
  'Filtering URLs…',
  'Scraping listings…',
  'Parsing prices…',
];

const STAGE_INTERVAL_MS = 2000;

export default function SearchProgress({ platforms, statuses, errors, counts }: Props) {
  const total = platforms.length;
  const settled = platforms.filter(
    (p) => statuses[p] === 'done' || statuses[p] === 'failed'
  ).length;

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {settled === total ? 'Search complete' : 'Searching platforms…'}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {settled} / {total}
        </p>
      </div>

      <div className="space-y-2">
        {platforms.map((platform) => (
          <PlatformRow
            key={platform}
            platform={platform}
            status={statuses[platform] ?? 'loading'}
            error={errors[platform]}
            count={counts?.[platform]}
          />
        ))}
      </div>
    </div>
  );
}

function PlatformRow({
  platform,
  status,
  error,
  count,
}: {
  platform: string;
  status: CheckpointStatus;
  error?: string;
  count?: number;
}) {
  const [stageIdx, setStageIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status === 'loading') {
      setStageIdx(0);
      intervalRef.current = setInterval(() => {
        setStageIdx((i) => Math.min(i + 1, STAGES.length - 1));
      }, STAGE_INTERVAL_MS);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status]);

  const fillClass =
    status === 'done'
      ? 'bar-fill-done'
      : status === 'failed'
        ? 'bar-fill-failed'
        : 'bar-fill-loading';

  let label: string;
  if (status === 'done') {
    label = typeof count === 'number' ? `Done — ${count} result${count === 1 ? '' : 's'}` : 'Done';
  } else if (status === 'failed') {
    label = error ? `Failed — ${error}` : 'Failed';
  } else {
    label = STAGES[stageIdx];
  }

  const visibleStages = status === 'loading' ? STAGES.slice(0, stageIdx + 1) : STAGES;
  const color = platformColor(platform);
  const rowStyle: CSSProperties = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    // CSS var consumed by .bar-fill-loading for the shimmer color.
    ['--row-color' as string]: color,
  };

  return (
    <div className="rounded-xl p-3 transition-colors" style={rowStyle}>
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <StatusDot status={status} color={color} />
          <PlatformBadge platform={platform} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="bar-track">
            <div className={fillClass} />
          </div>
          <p
            className="mt-1.5 truncate text-[11px]"
            style={{
              color: status === 'failed' ? 'var(--danger)' : 'var(--text-muted)',
            }}
            title={status === 'failed' && error ? error : undefined}
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
          {visibleStages.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span
                className="inline-block h-1 w-1 rounded-full"
                style={{
                  background:
                    status === 'failed'
                      ? 'var(--danger)'
                      : i === visibleStages.length - 1 && status === 'loading'
                        ? 'var(--accent)'
                        : 'var(--text-dim)',
                }}
              />
              <span>{s}</span>
            </li>
          ))}
          {status === 'done' && (
            <li className="flex items-center gap-2" style={{ color: 'var(--accent)' }}>
              <span className="inline-block h-1 w-1 rounded-full" style={{ background: 'var(--accent)' }} />
              <span>Complete</span>
            </li>
          )}
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
