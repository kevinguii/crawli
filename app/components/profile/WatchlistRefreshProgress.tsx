'use client';

import {
  ProgressPanel,
  ProgressRow,
  type CheckpointStatus,
  type ProgressDetailLine,
} from '@/app/components/ProgressPanel';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$', JPY: '¥',
};

function money(price: number | null, currency: string): string {
  if (price === null) return '-';
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  return `${symbol}${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

/** One finished listing check, in the order the stream reported it. */
export interface RefreshItem {
  id: string;
  title: string;
  currency: string;
  previousPrice: number | null;
  price: number | null;
  sold: boolean;
  ok: boolean;
}

export interface RefreshState {
  /** Platform order, seeded from the stream's `start` event. */
  platforms: string[];
  /** How many listings each platform contributes. */
  totals: Record<string, number>;
  /** Finished checks per platform. */
  items: Record<string, RefreshItem[]>;
  total: number;
  completed: number;
}

export function emptyRefreshState(): RefreshState {
  return { platforms: [], totals: {}, items: {}, total: 0, completed: 0 };
}

/**
 * The tracked-listings equivalent of `SearchProgress`: same panel, same rows,
 * same cancel affordance. The difference is that progress here is real rather
 * than a stage animation: each platform row fills as its listings come back,
 * and expanding a row lists what actually changed.
 */
export default function WatchlistRefreshProgress({
  state,
  onCancel,
}: {
  state: RefreshState;
  onCancel?: () => void;
}) {
  // Nothing to refresh (every tracked listing is already marked sold). The
  // server sends start/done with no work, so there is no panel worth showing.
  if (state.total === 0) return null;

  const running = state.completed < state.total;

  return (
    <ProgressPanel
      title={running ? 'Refreshing tracked listings…' : 'Refresh complete'}
      counter={`${state.completed} / ${state.total}`}
      onCancel={onCancel}
      showCancel={running}
    >
      {state.platforms.map((platform) => (
        <PlatformRefreshRow
          key={platform}
          platform={platform}
          total={state.totals[platform] ?? 0}
          items={state.items[platform] ?? []}
        />
      ))}
    </ProgressPanel>
  );
}

function PlatformRefreshRow({
  platform,
  total,
  items,
}: {
  platform: string;
  total: number;
  items: RefreshItem[];
}) {
  const done = items.length;
  const failed = items.filter((i) => !i.ok).length;
  const sold = items.filter((i) => i.ok && i.sold).length;
  const changed = items.filter(
    (i) => i.ok && !i.sold && i.price !== i.previousPrice
  ).length;

  let status: CheckpointStatus;
  if (done < total) status = 'loading';
  else if (failed === total) status = 'failed';
  else status = 'done';

  let label: string;
  if (status === 'loading') {
    label = `Checking ${Math.min(done + 1, total)} of ${total}…`;
  } else if (status === 'failed') {
    label = `Failed: couldn't check ${total} listing${total !== 1 ? 's' : ''}`;
  } else {
    const parts = [`Checked ${total} listing${total !== 1 ? 's' : ''}`];
    if (changed > 0) parts.push(`${changed} price change${changed !== 1 ? 's' : ''}`);
    if (sold > 0) parts.push(`${sold} sold`);
    if (failed > 0) parts.push(`${failed} failed`);
    label = parts.join(' · ');
  }

  // Keep a sliver of bar visible before the first listing lands, so a queued
  // platform still reads as in-flight rather than as an empty track.
  const fill = status === 'loading' ? Math.max(0.08, total > 0 ? done / total : 0) : 1;

  const details: ProgressDetailLine[] = items.map((item) => {
    if (!item.ok) {
      return { text: `${item.title} · check failed`, dot: 'var(--danger)', title: item.title };
    }
    if (item.sold) {
      return {
        text: `${item.title} · no longer available`,
        dot: 'var(--danger)',
        title: item.title,
      };
    }
    if (item.price !== item.previousPrice) {
      const dropped =
        item.price !== null && item.previousPrice !== null && item.price < item.previousPrice;
      return {
        text: `${item.title} · ${money(item.previousPrice, item.currency)} → ${money(item.price, item.currency)}`,
        dot: dropped ? 'var(--success)' : '#E24B4A',
        title: item.title,
      };
    }
    return { text: `${item.title} · unchanged`, title: item.title };
  });

  if (status === 'loading' && details.length === 0) {
    details.push({ text: 'Queued…', dot: 'var(--accent)' });
  }
  if (status === 'done') {
    details.push({ text: 'Complete', dot: 'var(--success)', color: 'var(--success)' });
  }

  return (
    <ProgressRow
      platform={platform}
      status={status}
      label={label}
      fill={fill}
      details={details}
    />
  );
}
