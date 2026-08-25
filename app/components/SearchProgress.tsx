'use client';

import { useEffect, useRef, useState } from 'react';
import { ProgressPanel, ProgressRow, type ProgressDetailLine } from './ProgressPanel';
import { TIER_CAPS } from '@/lib/tierCaps';

export type { CheckpointStatus } from './ProgressPanel';
import type { CheckpointStatus } from './ProgressPanel';

interface Props {
  platforms: string[];
  statuses: Record<string, CheckpointStatus>;
  errors: Record<string, string>;
  counts?: Record<string, number>;
  nativeResultsCap?: number | null;
  onCancel?: () => void;
}

const STAGES = [
  'Submitting search…',
  'Filtering URLs…',
  'Scraping listings…',
  'Parsing prices…',
];

const STAGE_INTERVAL_MIN_MS = 3000;
const STAGE_INTERVAL_MAX_MS = 5000;

function nextStageDelay() {
  return STAGE_INTERVAL_MIN_MS + Math.random() * (STAGE_INTERVAL_MAX_MS - STAGE_INTERVAL_MIN_MS);
}

export default function SearchProgress({ platforms, statuses, errors, counts, nativeResultsCap, onCancel }: Props) {
  const total = platforms.length;
  const settled = platforms.filter(
    (p) => statuses[p] === 'done' || statuses[p] === 'failed'
  ).length;
  const isSearching = settled < total;

  return (
    <ProgressPanel
      title={
        settled === total
          ? 'Search complete'
          : `Searching platforms… (up to ${nativeResultsCap ?? TIER_CAPS.free.nativeResultsCap} per native platform)`
      }
      counter={`${settled} / ${total}`}
      onCancel={onCancel}
      showCancel={isSearching}
    >
      {platforms.map((platform) => (
        <PlatformRow
          key={platform}
          platform={platform}
          status={statuses[platform] ?? 'loading'}
          error={errors[platform]}
          count={counts?.[platform]}
        />
      ))}
    </ProgressPanel>
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let resetTimeout: number | null = null;

    const clearPending = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    if (status === 'loading') {
      resetTimeout = window.setTimeout(() => setStageIdx(0), 0);
      const scheduleNext = () => {
        timeoutRef.current = setTimeout(() => {
          setStageIdx((i) => {
            const next = Math.min(i + 1, STAGES.length - 1);
            if (next < STAGES.length - 1) scheduleNext();
            return next;
          });
        }, nextStageDelay());
      };
      scheduleNext();
    } else {
      clearPending();
    }

    return () => {
      if (resetTimeout !== null) {
        window.clearTimeout(resetTimeout);
      }
      clearPending();
    };
  }, [status]);

  // Gradually fill the bar as fake stages progress, instead of jumping straight to full.
  const loadingProgress = (stageIdx + 1) / STAGES.length;
  const fillScale = status === 'loading' ? loadingProgress : 1;

  let label: string;
  if (status === 'done') {
    if (typeof count === 'number') {
      label = `Found ${count} result${count !== 1 ? 's' : ''}`;
    } else {
      label = 'Done';
    }
  } else if (status === 'failed') {
    label = error ? `Failed: ${error}` : 'Failed';
  } else {
    label = STAGES[stageIdx];
  }

  const visibleStages = status === 'loading' ? STAGES.slice(0, stageIdx + 1) : STAGES;
  const details: ProgressDetailLine[] = visibleStages.map((s, i) => ({
    text: s,
    dot:
      status === 'failed'
        ? 'var(--danger)'
        : i === visibleStages.length - 1 && status === 'loading'
          ? 'var(--accent)'
          : 'var(--text-dim)',
  }));
  if (status === 'done') {
    details.push({ text: 'Complete', dot: 'var(--success)', color: 'var(--success)' });
  }

  return (
    <ProgressRow
      platform={platform}
      status={status}
      label={label}
      fill={fillScale}
      details={details}
      errorTitle={status === 'failed' && error ? error : undefined}
    />
  );
}
