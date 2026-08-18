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

interface FeatureGroup {
  label: string;
  items: string[];
}

interface TierConfig {
  tier: PaidTier;
  name: string;
  icon: React.ReactNode;
  tagline: string;
  weekly: number;
  monthly: number;
  yearly: number; // total billed yearly
  featureGroups: FeatureGroup[];
  highlight?: boolean;
}

const NATIVE_TOOLTIP = (
  <>
    <strong style={{ color: 'var(--text)' }}>Native platforms</strong> return
    unlimited results on Pro, and up to 8 per search on Free. eBay returns up to
    10 per search on every plan.
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

// Two plans, not three. Pro and Max previously differed only by integers — five of
// six lines were the same feature with a bigger number — which is a volume discount
// rather than a tier, and 0 of 46 users ever chose the middle one. Max is retired
// from this page but stays resolvable in lib/tierCaps so no legacy price ID
// downgrades anyone. See docs/superpowers/specs/2026-08-17-paywall-repackaging-design.md.
//
// Grouped into "Basic" and "Advanced" rather than one flat list, for two reasons:
//
// 1. The four price-intelligence facts (sold prices, range, margin, low/median/
//    high) are really one capability, price intelligence, described four ways.
//    Folding them into a single "Advanced" bullet reads as one clear unlock
//    instead of a padded bullet count or its own multi-line block.
// 2. Basic rows are in IDENTICAL order on both cards (only the numbers change), so
//    a reader scanning the two columns side by side sees searches-vs-searches,
//    saves-vs-saves on the same row: a real 1:1 comparison instead of two
//    differently-ordered lists they have to cross-reference by hand.
//
// Saves and tracked listings say "Unlimited" on Pro as of 2026-08-17 even though
// TIER_CAPS.pro still hard-caps both at 500 (see lib/tierCaps.ts) — 500 is a
// practical ceiling nobody real approaches, not a felt limit, so the marketing
// copy and the enforced cap are allowed to diverge here. If that cap ever tightens
// enough to be reachable, this copy needs to change with it.
//
// As of 2026-08-18 SEARCHES and RESULTS DEPTH join that list: both read
// "Unlimited" on Pro while TIER_CAPS.pro enforces 50/week and 100 per native
// platform. Same reasoning, and the margin work backing it is in lib/tierCaps.ts —
// the busiest user-week ever recorded is 13 searches, nobody has ever reached even
// the old cap of 40, and break-even on a $10/mo sub is ~495 searches/month. The
// caps are abuse backstops. Two obligations that come with the word:
//   1. Pro must never see a hard "you have used all N searches" wall — the 402 in
//      app/api/search/route.ts carries tier-specific copy for this reason.
//   2. If a real user ever lands on either cap, raise the cap or drop the word.
//      Do not quietly leave "Unlimited" over a limit somebody actually hit.
//
// If you add or reorder a Basic row on one plan, mirror it on the other or the
// alignment breaks.
const BASIC_LABEL = 'Basic';
const ADVANCED_LABEL = 'Advanced';

const PAID_TIERS: TierConfig[] = [
  {
    tier: 'pro',
    name: 'Pro',
    icon: '✦',
    tagline: 'Know what it is worth before you buy',
    weekly: 3,
    monthly: 10,
    yearly: 100,
    featureGroups: [
      {
        label: BASIC_LABEL,
        items: [
          'Unlimited searches',
          'Unlimited results on every native platform',
          '8 alerts, checked daily',
          'Unlimited saves and tracked listings',
          'Email + in-app alert notifications',
        ],
      },
      {
        label: ADVANCED_LABEL,
        items: [
          'Sold prices, price range, and your margin after real marketplace fees',
        ],
      },
    ],
    highlight: true,
  },
];

const FREE_FEATURE_GROUPS: FeatureGroup[] = [
  {
    label: BASIC_LABEL,
    items: [
      '5 searches per week',
      'Standard results on every native platform',
      '1 alert, checked daily',
      '10 saves · 10 tracked listings',
      'Email + in-app alert notifications',
    ],
  },
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

      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
        {/* ── Free plan ── */}
        <PlanCard
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text)' }} aria-hidden>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          }
          name="Free"
          tagline="See what is listed, everywhere"
          priceLabel="$0"
          priceSubLabel="/mo"
          isCurrent={isFree}
          ctaLabel={isFree ? 'Current plan' : 'Free plan'}
          ctaDisabled
          featureGroups={FREE_FEATURE_GROUPS}
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
              featureGroups={t.featureGroups}
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
          On Free and need more searches? Add credit packs anytime.
        </p>
        <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Once your Free plan searches are used up, you can buy prepaid credit packs as a one-time purchase. No subscription, no surprise charges, no debt. One credit equals one search and rolls over until used.
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
          Pro includes unlimited searches — packs are for the Free plan
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
  featureGroups: FeatureGroup[];
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
  featureGroups,
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

      <FeatureList groups={featureGroups} tooltips={featureTooltips} />
    </div>
  );
}

// Basic rows are in identical order across plans (see BASIC_LABEL comment above
// PAID_TIERS), so stacking each group's items in a plain vertical flow is enough
// to keep the Free and Pro "Basic" rows lined up row-for-row — no grid/table
// needed. Advanced only exists on Pro, so it simply extends below where Free's
// list ends.
function FeatureList({ groups, tooltips }: { groups: FeatureGroup[]; tooltips?: Record<string, React.ReactNode> }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p
            className="mb-2 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: group.label === ADVANCED_LABEL ? 'var(--accent)' : 'var(--text-dim)' }}
          >
            {group.label}
          </p>
          <ul className="space-y-2">
            {group.items.map((f) => (
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
        </div>
      ))}
    </div>
  );
}
