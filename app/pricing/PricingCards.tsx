'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Tier } from '@/lib/stripe';

type Cycle = 'monthly' | 'yearly';
type PaidTier = Exclude<Tier, 'free'>;

interface TierConfig {
  tier: PaidTier;
  name: string;
  icon: string;
  tagline: string;
  monthly: number;
  yearly: number; // total billed yearly
  features: string[];
  highlight?: boolean;
}

const PAID_TIERS: TierConfig[] = [
  {
    tier: 'pro',
    name: 'Pro',
    icon: '✦',
    tagline: 'More searches, more alerts',
    monthly: 10,
    yearly: 100,
    features: [
      '75 searches per month',
      '3 search alerts',
      '200 tracked listings',
      'Up to 30 results per native platform',
      'Email + in-app alert notifications',
    ],
    highlight: true,
  },
  {
    tier: 'max',
    name: 'Max',
    icon: '★',
    tagline: 'For power users',
    monthly: 30,
    yearly: 300,
    features: [
      '300 searches per month',
      '10 search alerts',
      '1,000 tracked listings',
      'Up to 60 results per native platform',
      'Email + in-app alert notifications',
      'Alert health sparkline',
    ],
  },
];

const FREE_FEATURES = [
  '10 searches per month',
  '1 search alert',
  '50 tracked listings',
  'Up to 10 results per native platform',
  'Email + in-app alert notifications',
];

export function PricingCards({
  isSignedIn,
  currentTier,
}: {
  isSignedIn: boolean;
  currentTier: Tier;
}) {
  const [cycle, setCycle] = useState<Cycle>('yearly');
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubscribe(tier: PaidTier) {
    if (!isSignedIn) {
      router.push('/login?next=/pricing');
      return;
    }
    const key = `${tier}-${cycle}`;
    setLoading(key);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, cycle }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error ?? 'Could not start checkout');
        setLoading(null);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(null);
    }
  }

  async function handleManage() {
    setLoading('portal');
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error ?? 'Could not open billing portal');
        setLoading(null);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(null);
    }
  }

  const isFree = currentTier === 'free';

  return (
    <>
      {/* Billing cycle toggle — shared across paid cards */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => setCycle(cycle === 'monthly' ? 'yearly' : 'monthly')}
          className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-lg transition-all duration-200"
          style={{ background: cycle === 'yearly' ? 'var(--accent)' : 'var(--border)' }}
          aria-label="Toggle billing cycle"
          role="switch"
          aria-checked={cycle === 'yearly'}
        >
          <span
            className="inline-block h-5 w-5 bg-white transition-transform duration-200"
            style={{
              transform: cycle === 'yearly' ? 'translateX(1.5rem)' : 'translateX(0.25rem)',
              borderRadius: '5px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }}
          />
        </button>
        <span className="text-sm" style={{ color: 'var(--text)' }}>
          {cycle === 'yearly' ? 'Billed yearly' : 'Billed monthly'}
        </span>
        <span
          className="text-xs font-semibold"
          style={{ color: cycle === 'yearly' ? 'var(--accent)' : 'transparent', userSelect: 'none' }}
        >
          Save 17%
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ── Free plan ── */}
        <PlanCard
          icon="⚡"
          name="Free"
          tagline="Get started at no cost"
          priceLabel="$0"
          priceSubLabel="/mo"
          isCurrent={isFree}
          ctaLabel={isFree ? 'Current plan' : 'Free plan'}
          ctaDisabled
          features={FREE_FEATURES}
        />

        {/* ── Paid tiers ── */}
        {PAID_TIERS.map((t) => {
          const isCurrent = currentTier === t.tier;
          const displayPriceNum = cycle === 'yearly' ? t.yearly / 12 : t.monthly;
          const priceLabel = `$${displayPriceNum % 1 === 0 ? displayPriceNum : displayPriceNum.toFixed(2)}`;
          const yearlyHint = cycle === 'yearly' ? `$${t.yearly} billed yearly` : null;
          const loadingKey = `${t.tier}-${cycle}`;
          const ctaLabel = isCurrent
            ? (loading === 'portal' ? 'Opening…' : 'Manage subscription')
            : (loading === loadingKey ? 'Loading…' : 'Subscribe');

          return (
            <PlanCard
              key={t.tier}
              icon={t.icon}
              name={t.name}
              tagline={t.tagline}
              priceLabel={priceLabel}
              priceSubLabel="/mo"
              priceHint={yearlyHint}
              highlight={t.highlight}
              isCurrent={isCurrent}
              ctaLabel={ctaLabel}
              ctaDisabled={loading !== null}
              onCtaClick={() => (isCurrent ? handleManage() : handleSubscribe(t.tier))}
              features={t.features}
            />
          );
        })}
      </div>
    </>
  );
}

interface PlanCardProps {
  icon: string;
  name: string;
  tagline: string;
  priceLabel: string;
  priceSubLabel: string;
  priceHint?: string | null;
  highlight?: boolean;
  isCurrent: boolean;
  ctaLabel: string;
  ctaDisabled?: boolean;
  onCtaClick?: () => void;
  features: string[];
}

function PlanCard({
  icon,
  name,
  tagline,
  priceLabel,
  priceSubLabel,
  priceHint,
  highlight,
  isCurrent,
  ctaLabel,
  ctaDisabled,
  onCtaClick,
  features,
}: PlanCardProps) {
  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border)'}`,
        padding: '1.5rem',
        boxShadow: highlight ? '0 8px 24px rgba(0,0,0,0.08)' : undefined,
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <span className="text-base font-semibold" style={{ color: 'var(--text)' }}>{name}</span>
        {isCurrent && (
          <span
            className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Current plan
          </span>
        )}
      </div>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{tagline}</p>

      <hr className="my-4" style={{ borderColor: 'var(--border)' }} />

      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-3xl font-bold" style={{ color: 'var(--text)' }}>{priceLabel}</span>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{priceSubLabel}</span>
      </div>
      <div style={{ minHeight: '18px', marginBottom: '1rem' }}>
        {priceHint && (
          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{priceHint}</span>
        )}
      </div>

      <button
        type="button"
        onClick={onCtaClick}
        disabled={ctaDisabled || !onCtaClick}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity mb-5"
        style={{
          background: onCtaClick ? 'var(--accent)' : 'var(--surface)',
          color: onCtaClick ? '#fff' : 'var(--text-dim)',
          border: onCtaClick ? 'none' : '1px solid var(--border)',
          opacity: ctaDisabled ? 0.6 : 1,
          cursor: !onCtaClick ? 'default' : (ctaDisabled ? 'not-allowed' : 'pointer'),
        }}
      >
        {ctaLabel}
      </button>

      <FeatureList included={features} />
    </div>
  );
}

function FeatureList({ included }: { included: string[] }) {
  return (
    <ul className="space-y-2">
      {included.map((f) => (
        <li key={f} className="flex items-start gap-2" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden style={{ color: 'var(--accent)', marginTop: '1px', flexShrink: 0 }}>
            <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {f}
        </li>
      ))}
    </ul>
  );
}
