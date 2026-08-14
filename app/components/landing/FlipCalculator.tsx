'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  FEE_PLATFORMS,
  MARKETPLACE_FEES,
  netFlipProfit,
} from '@/lib/marketplaceFees';
import type { PlatformKey } from '@/lib/types';

// Order the selector so the most common flip destinations lead.
const PLATFORM_ORDER: PlatformKey[] = [
  'ebay', 'grailed', 'depop', 'poshmark', 'mercari', 'vinted', 'stockx',
].filter((p): p is PlatformKey => FEE_PLATFORMS.includes(p as PlatformKey));

function parseMoney(v: string): number {
  const n = parseFloat(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function MoneyField({
  label,
  value,
  onChange,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  id: string;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
        {label}
      </span>
      <div
        className="flex items-center rounded-xl px-3 focus-within:ring-2"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          // @ts-expect-error CSS custom prop for the focus ring color
          '--tw-ring-color': 'var(--accent-soft)',
        }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--text-dim)' }}>$</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent py-2.5 pl-1.5 text-base font-semibold tabular-nums outline-none"
          style={{ color: 'var(--text)' }}
          aria-label={label}
        />
      </div>
    </label>
  );
}

export default function FlipCalculator() {
  const [source, setSource] = useState('40');
  const [resale, setResale] = useState('100');
  const [platform, setPlatform] = useState<PlatformKey>(PLATFORM_ORDER[0]);

  const result = useMemo(() => {
    return netFlipProfit({
      sourcingPrice: parseMoney(source),
      resalePrice: parseMoney(resale),
      platform,
    });
  }, [source, resale, platform]);

  const profitable = result.netProfit >= 0;
  const fmtMoney = (n: number) =>
    `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const fmtPct = (n: number) => `${Math.round(n)}%`;

  return (
    <div
      className="w-full rounded-2xl p-5 text-left sm:p-6"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 20px 50px -20px rgba(226,75,74,0.28), 0 4px 12px rgba(0,0,0,0.06)',
      }}
    >
      <div className="mb-4 flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Flip margin calculator</p>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>Real seller fees · no login</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MoneyField id="calc-source" label="Source price" value={source} onChange={setSource} />
        <MoneyField id="calc-resale" label="Resell price" value={resale} onChange={setResale} />
      </div>

      <label htmlFor="calc-platform" className="mt-3 flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
          Resell on
        </span>
        <select
          id="calc-platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as PlatformKey)}
          className="w-full cursor-pointer rounded-xl px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            // @ts-expect-error CSS custom prop for the focus ring color
            '--tw-ring-color': 'var(--accent-soft)',
          }}
        >
          {PLATFORM_ORDER.map((p) => (
            <option key={p} value={p}>{MARKETPLACE_FEES[p].label}</option>
          ))}
        </select>
      </label>

      <div
        className="mt-4 grid grid-cols-3 gap-2 rounded-xl p-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="text-center">
          <div
            className="text-lg font-bold leading-none tabular-nums sm:text-xl"
            style={{ color: profitable ? 'var(--accent)' : 'var(--danger, #DC2626)' }}
          >
            {fmtMoney(result.netProfit)}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Net profit</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold leading-none tabular-nums sm:text-xl" style={{ color: 'var(--text)' }}>
            {fmtPct(result.marginPct)}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Margin</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold leading-none tabular-nums sm:text-xl" style={{ color: 'var(--text)' }}>
            {fmtPct(result.roiPct)}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>ROI</div>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
        {fmtMoney(result.fees)} in {MARKETPLACE_FEES[platform].label} seller fees · rates verified {MARKETPLACE_FEES[platform].lastVerified}
      </p>

      <Link
        href="/login?tab=signup"
        className="mt-4 flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
        style={{
          background: 'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27)',
          color: '#fff',
        }}
      >
        Start comparing free
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </Link>
    </div>
  );
}
