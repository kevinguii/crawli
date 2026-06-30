'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Tier } from '@/lib/stripe';
import { CREDIT_PACKS } from '@/lib/creditPacks';
import InfoTooltip from '@/app/components/InfoTooltip';

const ALERT_EMAIL_TOOLTIP = (
  <>
    <strong style={{ color: 'var(--text)' }}>Emails only send when new listings are found.</strong> Your alert checks on schedule (daily or weekly, at 9 AM), but we only notify you if results have changed since the last check. First run establishes your baseline.
  </>
);

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
    higher result counts on Pro and Max plans. eBay returns up to 10 per search
    on every plan.
    <div style={{ marginTop: '6px' }}>
      <span style={{ color: 'var(--text-muted)' }}>Native:</span>{' '}
      Grailed, Depop, Mercari, ThredUp, Vestiaire, Vinted, Poshmark, StockX
    </div>
    <div style={{ marginTop: '4px' }}>
      <span style={{ color: 'var(--text-muted)' }}>Other:</span>{' '}
      eBay
    </div>
  </>
);

const PAID_TIERS: TierConfig[] = [
  {
    tier: 'pro',
    name: 'Pro',
    icon: '✦',
    tagline: 'For active resellers',
    weekly: 3,
    monthly: 10,
    yearly: 100,
    features: [
      '40 searches per week',
      '8 search alerts',
      '500 tracked listings',
      'Up to 60 results per native platform',
      'Email + in-app alert notifications',
    ],
    highlight: true,
  },
  {
    tier: 'max',
    name: 'Max',
    icon: '★',
    tagline: 'For serious sourcing operations',
    weekly: 10,
    monthly: 30,
    yearly: 300,
    features: [
      '120 searches per week',
      '20 search alerts',
      'Unlimited tracked listings',
      'Up to 100 results per native platform',
      'Email + in-app alert notifications',
      'Alert health sparkline',
    ],
  },
];

const FREE_FEATURES: string[] = [
  '5 searches per week',
  '2 search alerts',
  '50 tracked listings',
  'Up to 15 results per native platform',
  'Email + in-app alert notifications',
];

export function PricingCards({
  isSignedIn,
  currentTier,
}: {
  isSignedIn: boolean;
  currentTier: Tier;
}) {
  const [cycle, setCycle] = useState<Cycle>('weekly');
  const [loading, setLoading] = useState<string | null>(null);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
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

  async function handleBuyCredits(packId: string) {
    if (!isSignedIn) {
      router.push('/login?next=/pricing');
      return;
    }
    setBuyingPack(packId);
    try {
      const res = await fetch('/api/billing/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack: packId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.message ?? 'Could not start checkout');
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBuyingPack(null);
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
                  className="absolute -top-2.5 -right-2.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
                  style={{
                    background: cycle === 'yearly' ? 'var(--accent-text)' : 'var(--accent)',
                    color: cycle === 'yearly' ? '#111110' : '#fff',
                  }}
                >
                  Best value
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:items-start">
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
          featureTooltips={{ 'Email + in-app alert notifications': ALERT_EMAIL_TOOLTIP }}
          reassurance="No credit card required"
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
          // Savings hints: monthly saves vs weekly, yearly saves vs monthly
          const monthlySavingPct = Math.round((1 - (t.monthly / (52 / 12)) / t.weekly) * 100);
          const yearlySavingPct = Math.round((1 - (t.yearly / 12) / t.monthly) * 100);
          const priceHint =
            cycle === 'monthly' ? `Save ${monthlySavingPct}% vs weekly` :
            cycle === 'yearly' ? `Save ${yearlySavingPct}% vs monthly · $${t.yearly}/yr` :
            null;

          return (
            <PlanCard
              key={t.tier}
              icon={t.icon}
              name={t.name}
              tagline={t.tagline}
              priceLabel={priceLabel}
              priceSubLabel={priceSubLabel}
              priceHint={priceHint}
              highlight={t.highlight}
              isCurrent={isCurrent}
              ctaLabel={ctaLabel}
              ctaDisabled={loading !== null}
              onCtaClick={() => (isCurrent || isOnOtherPaidPlan ? handleManage() : handleSubscribe(t.tier))}
              features={t.features}
              featureTooltips={{ 'Email + in-app alert notifications': ALERT_EMAIL_TOOLTIP }}
              reassurance="Cancel anytime"
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
          What&rsquo;s a native platform?
          <InfoTooltip content={NATIVE_TOOLTIP} label="What is a native platform?" />
        </span>
      </div>

      {/* Credit pack overage */}
      <div
        id="credits"
        className="mt-10 scroll-mt-24 rounded-2xl p-6 text-center"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
        }}
      >
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Need more searches? Add credit packs anytime.
        </p>
        <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Once your included searches are used up, you can buy prepaid credit packs as a one-time purchase. No subscription, no surprise charges, no debt. One credit equals one search and rolls over until used.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              onClick={() => handleBuyCredits(pack.id)}
              disabled={buyingPack !== null}
              className="btn-credit-pack rounded-xl px-4 py-2 text-sm font-medium"
            >
              {buyingPack === pack.id ? 'Redirecting…' : `${pack.searches.toLocaleString()} searches · $${pack.priceUsd}`}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--text-dim)' }}>
          Included in all plans
        </p>
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
  featureTooltips?: Record<string, React.ReactNode>;
  reassurance?: string;
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
  featureTooltips,
  reassurance,
}: PlanCardProps) {
  return (
    <div
      className="relative rounded-xl flex flex-col transition-transform duration-200 md:hover:-translate-y-1"
      style={{
        background: highlight
          ? 'linear-gradient(180deg, var(--accent-soft), var(--bg-elevated) 45%)'
          : 'var(--bg-elevated)',
        border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border)'}`,
        padding: '1.5rem',
        boxShadow: highlight ? '0 12px 32px -8px var(--accent-soft)' : undefined,
        transform: highlight ? 'scale(1.03)' : undefined,
        zIndex: highlight ? 1 : undefined,
      }}
    >
      {highlight && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap"
          style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 4px 12px -2px var(--accent-soft)' }}
        >
          Most popular
        </span>
      )}
      <div className="flex items-center gap-2">
        <span className="flex items-center" style={{ fontSize: '1.1rem', lineHeight: 1, color: highlight ? 'var(--accent)' : undefined }}>{icon}</span>
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
        <span
          className="font-bold"
          style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontSize: highlight ? '2.25rem' : '1.875rem' }}
        >
          {priceLabel}
        </span>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{priceSubLabel}</span>
      </div>
      <div style={{ minHeight: '18px', marginBottom: '1rem' }}>
        {priceHint && (
          <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{priceHint}</span>
        )}
      </div>

      <button
        type="button"
        onClick={onCtaClick}
        disabled={ctaDisabled || !onCtaClick}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] mb-2 hover:brightness-110"
        style={{
          background: onCtaClick ? 'var(--accent)' : 'var(--surface)',
          color: onCtaClick ? '#fff' : 'var(--text-dim)',
          border: onCtaClick ? 'none' : '1px solid var(--border)',
          opacity: ctaDisabled ? 0.6 : 1,
          cursor: !onCtaClick ? 'default' : (ctaDisabled ? 'not-allowed' : 'pointer'),
          boxShadow: highlight && !ctaDisabled ? '0 4px 14px -2px var(--accent-soft)' : undefined,
        }}
      >
        {ctaLabel}
      </button>

      {reassurance && (
        <p className="text-center text-xs mb-5" style={{ color: 'var(--text-dim)' }}>
          {reassurance}
        </p>
      )}
      {!reassurance && <div className="mb-5" />}

      <FeatureList included={features} tooltips={featureTooltips} />
    </div>
  );
}

function FeatureList({ included, tooltips }: { included: string[]; tooltips?: Record<string, React.ReactNode> }) {
  return (
    <ul className="space-y-2">
      {included.map((f) => (
        <li key={f} className="flex items-start gap-2" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden style={{ color: 'var(--accent)', marginTop: '1px', flexShrink: 0 }}>
            <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="flex items-center gap-1">
            {f}
            {tooltips?.[f] && (
              <InfoTooltip content={tooltips[f]} label={`More info: ${f}`} />
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
