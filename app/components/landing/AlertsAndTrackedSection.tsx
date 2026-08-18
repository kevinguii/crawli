'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import PlatformBadge from '@/app/components/PlatformBadge';
import MockFrame from './MockFrame';

type Alert = {
  query: string;
  platforms: string[];
  newCount: number;
  lastChecked: string;
};

const ALERTS: Alert[] = [
  { query: 'stussy world tour hoodie', platforms: ['Grailed', 'Depop', 'Vinted'], newCount: 4, lastChecked: '12m ago' },
  { query: 'maison margiela tabi 39', platforms: ['Grailed', 'Vestiaire'], newCount: 1, lastChecked: '1h ago' },
  { query: 'arcteryx beta ar medium', platforms: ['Grailed', 'eBay', 'Poshmark'], newCount: 0, lastChecked: '3h ago' },
];

type Saved = {
  platform: string;
  title: string;
  price: string;
  oldPrice?: string;
  drop?: string;
};

const SAVED: Saved[] = [
  { platform: 'grailed', title: 'Rick Owens DRKSHDW Geobasket', price: '$320' },
  { platform: 'depop', title: 'Carhartt Detroit Jacket, Hamilton Brown', price: '$118', oldPrice: '$140', drop: '16%' },
  { platform: 'vestiaire', title: 'Margiela 5AC Mini Bag', price: '$680' },
  { platform: 'stockx', title: 'Air Jordan 1 Mocha, size 10', price: '$268', oldPrice: '$295', drop: '9%' },
];

function AlertsPanel() {
  return (
    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {ALERTS.map((a, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 px-5 py-4"
          style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
        >
          <div className="flex min-w-0 items-center gap-3">
            {a.newCount > 0 ? (
              <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: 'var(--accent)' }}
              >
                {a.newCount}
              </span>
            ) : (
              <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{a.query}</p>
              <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                {a.platforms.join(' · ')} · checked {a.lastChecked}
              </p>
            </div>
          </div>
          <span
            className="hidden flex-shrink-0 rounded-md px-3 py-1.5 text-xs font-medium sm:inline-block"
            style={{
              background: a.newCount > 0 ? 'var(--accent-soft)' : 'var(--surface)',
              color: a.newCount > 0 ? 'var(--accent-text)' : 'var(--text-muted)',
            }}
          >
            {a.newCount > 0 ? `${a.newCount} new` : 'No new matches'}
          </span>
        </div>
      ))}
      <div
        className="flex items-center justify-between gap-3 px-5 py-3"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Daily auto-check · Free: 1 alert · Pro: Unlimited alerts
        </span>
        {/* Was a dead aria-hidden button inside the mock. It reads as the one
            actionable control in this section, so it now goes to signup. */}
        <Link
          href="/login?tab=signup"
          className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          + New alert
        </Link>
      </div>
    </div>
  );
}

function TrackedPanel() {
  return (
    <>
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
          All
        </span>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-dim)' }}>{SAVED.length} tracked</span>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        {SAVED.map((s, i) => (
          <div key={i} className="overflow-hidden rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div
              className="relative h-32 w-full"
              style={{ background: 'linear-gradient(135deg, var(--surface-hover), var(--track))' }}
            >
              <div className="absolute left-2 top-2">
                <PlatformBadge platform={s.platform} />
              </div>
              <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#E24B4A" stroke="#E24B4A" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
            </div>
            <div className="p-3">
              <p className="line-clamp-2 text-xs" style={{ color: 'var(--text-muted)' }}>{s.title}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--text)' }}>{s.price}</span>
                {s.oldPrice && (
                  <span className="text-xs line-through tabular-nums" style={{ color: 'var(--text-dim)' }}>{s.oldPrice}</span>
                )}
                {s.drop && (
                  <span className="ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: 'var(--success)' }}>
                    ↓ {s.drop}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const TABS = [
  { key: 'alerts' as const, label: 'Alerts', url: 'thecrawli.com/alerts' },
  { key: 'tracked' as const, label: 'Tracked Listings', url: 'thecrawli.com/saves' },
];

export default function AlertsAndTrackedSection() {
  const [tab, setTab] = useState<'alerts' | 'tracked'>('alerts');
  const [visible, setVisible] = useState(true);
  const active = TABS.find((t) => t.key === tab)!;
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }, []);

  function selectTab(key: 'alerts' | 'tracked') {
    if (key === tab) return;
    if (reducedMotion.current) {
      setTab(key);
      return;
    }
    setVisible(false);
    setTimeout(() => {
      setTab(key);
      setVisible(true);
    }, 150);
  }

  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--accent-text)' }}>
            Never lose a deal
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: 'var(--text)' }}>
            Save it. We&apos;ll watch it.
          </h2>
          <p className="mt-3 text-base" style={{ color: 'var(--text-muted)' }}>
            Save a search or save a listing. Crawli rechecks both every day and
            notifies you the moment a new match appears or a price drops.
          </p>
        </div>

        <div className="mx-auto mt-8 flex w-fit gap-1 rounded-full p-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => selectTab(t.key)}
              className="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
              style={{
                background: tab === t.key ? 'var(--accent)' : 'transparent',
                color: tab === t.key ? '#fff' : 'var(--text-muted)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-8" style={{ opacity: visible ? 1 : 0, transition: 'opacity 150ms ease-out' }}>
          <MockFrame url={active.url}>
            {tab === 'alerts' ? <AlertsPanel /> : <TrackedPanel />}
          </MockFrame>
        </div>
      </div>
    </section>
  );
}
