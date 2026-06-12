'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Tier } from '@/lib/stripe';
import InfoTooltip from '@/app/components/InfoTooltip';

type Cycle = 'weekly' | 'monthly' | 'yearly';
type PaidTier = Exclude<Tier, 'free'>;

interface TierConfig {
  tier: PaidTier;
  name: string;
  icon: React.ReactNode;
  tagline: string;
  weekly: number;
  monthly: number;
  yearly: number; // total billed yearly
  features: string[];
  highlight?: boolean;
}

const NATIVE_TOOLTIP = (
  <>
    <strong style={{ color: 'var(--text)' }}>Native platforms</strong> support
    higher result counts on Pro and Max plans. Other platforms return up to 10
    per search on every plan.
    <div style={{ marginTop: '6px' }}>
      <span style={{ color: 'var(--text-muted)' }}>Native:</span>{' '}
      Grailed, Depop, Mercari, ThredUp, RealReal
    </div>
    <div style={{ marginTop: '4px' }}>
      <span style={{ color: 'var(--text-muted)' }}>Other:</span>{' '}
      Poshmark, Vinted, eBay, Vestiaire, StockX
    </div>
  </>
);

const PAID_TIERS: TierConfig[] = [
  {
    tier: 'pro',
    name: 'Pro',
    icon: '✦',
    tagline: 'More searches, more alerts',
    weekly: 5,
    monthly: 10,
    yearly: 100,
    features: [
      '20 searches per week',
      '3 search alerts',
      '200 tracked listings',
      'Up to 40 results per native platform',
      'Email + in-app alert notifications',
    ],
    highlight: true,
  },
  {
    tier: 'max',
    name: 'Max',
    icon: '★',
    tagline: 'For power users',
    weekly: 12,
    monthly: 30,
    yearly: 300,
    features: [
      '70 searches per week',
      '10 search alerts',
      '1,000 tracked listings',
      'Up to 80 results per native platform',
      'Email + in-app alert notifications',
      'Alert health sparkline',
    ],
  },
];

const FREE_FEATURES: string[] = [
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
  const [cycle, setCycle] = useState<Cycle>('monthly');
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
      {/* Billing cycle selector */}
      <div className="flex items-center justify-center mb-8">
        <div
          className="inline-flex rounded-xl p-1 gap-1"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {(['weekly', 'monthly', 'yearly'] as Cycle[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCycle(c)}
              className="relative rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-150"
              style={{
                background: cycle === c ? 'var(--accent)' : 'transparent',
                color: cycle === c ? '#fff' : 'var(--text-muted)',
              }}
            >
              {c.charAt(0).toUpperCase() + c.slice(1)}
              {c === 'yearly' && (
                <span
                  className="ml-1.5 text-xs font-semibold"
                  style={{ color: cycle === 'yearly' ? 'rgba(255,255,255,0.8)' : 'var(--accent)' }}
                >
                  −17%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ── Free plan ── */}
        <PlanCard
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text)' }} aria-hidden>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          }
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
          // User already has a paid plan — any plan change (upgrade, downgrade,
          // or billing cycle switch) goes through the Stripe Customer Portal so
          // Stripe handles proration. Only free users go to a new checkout.
          const isOnOtherPaidPlan = !isFree && !isCurrent;
          const loadingKey = `${t.tier}-${cycle}`;
          const ctaLabel = isCurrent
            ? (loading === 'portal' ? 'Opening…' : 'Manage subscription')
            : isOnOtherPaidPlan
            ? (loading === 'portal' ? 'Opening…' : `Switch to ${t.name}`)
            : (loading === loadingKey ? 'Loading…' : 'Subscribe');
          const displayPriceNum = cycle === 'yearly' ? t.yearly / 12 : cycle === 'weekly' ? t.weekly : t.monthly;
          const priceLabel = `$${displayPriceNum % 1 === 0 ? displayPriceNum : displayPriceNum.toFixed(2)}`;
          const priceSubLabel = cycle === 'weekly' ? '/wk' : '/mo';
          const yearlyHint = cycle === 'yearly' ? `$${t.yearly} billed yearly` : null;

          return (
            <PlanCard
              key={t.tier}
              icon={t.icon}
              name={t.name}
              tagline={t.tagline}
              priceLabel={priceLabel}
              priceSubLabel={priceSubLabel}
              priceHint={yearlyHint}
              highlight={t.highlight}
              isCurrent={isCurrent}
              ctaLabel={ctaLabel}
              ctaDisabled={loading !== null}
              onCtaClick={() => (isCurrent || isOnOtherPaidPlan ? handleManage() : handleSubscribe(t.tier))}
              features={t.features}
            />
          );
        })}
      </div>

      {/* Shared footnote — single tooltip explaining "native platform". */}
      <div className="mt-6 flex justify-center">
        <span
          className="inline-flex items-center gap-1.5 text-xs"
          style={{ color: 'var(--text-dim)' }}
        >
          What's a native platform?
          <InfoTooltip content={NATIVE_TOOLTIP} label="What is a native platform?" />
        </span>
      </div>
    </>
  );
}

interface PlanCardProps {
  icon: React.ReactNode;
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
        <span className="flex items-center" style={{ fontSize: '1.1rem', lineHeight: 1 }}>{icon}</span>
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
