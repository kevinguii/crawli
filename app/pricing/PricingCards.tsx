'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type Plan = 'monthly' | 'yearly';

export function PricingCards({ isSignedIn, isPro }: { isSignedIn: boolean; isPro: boolean }) {
  const [loading, setLoading] = useState<Plan | 'portal' | null>(null);
  const router = useRouter();

  async function handleSubscribe(plan: Plan) {
    if (!isSignedIn) {
      router.push('/login?next=/pricing');
      return;
    }
    setLoading(plan);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
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

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PlanCard
          title="Monthly"
          price="$10"
          cadence="per month"
          features={[
            '100 searches per month',
            'Unlimited saves',
            'Watchlist with price alerts',
            'Priority queue',
          ]}
          cta={ctaLabel(isPro, loading === 'monthly')}
          disabled={isPro || loading !== null}
          onClick={() => handleSubscribe('monthly')}
        />
        <PlanCard
          title="Yearly"
          price="$100"
          cadence="per year"
          badge="Save $20"
          features={[
            '100 searches per month',
            'Unlimited saves',
            'Watchlist with price alerts',
            'Priority queue',
            '2 months free vs monthly',
          ]}
          cta={ctaLabel(isPro, loading === 'yearly')}
          disabled={isPro || loading !== null}
          onClick={() => handleSubscribe('yearly')}
          highlight
        />
      </div>
      {isPro && (
        <div className="mt-8 text-center">
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            You&apos;re on Crawli Pro. Manage your subscription, change plans, update your card, or cancel anytime.
          </p>
          <button
            type="button"
            onClick={handleManage}
            disabled={loading !== null}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity"
            style={{
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              opacity: loading !== null ? 0.6 : 1,
              cursor: loading !== null ? 'not-allowed' : 'pointer',
            }}
          >
            {loading === 'portal' ? 'Opening…' : 'Manage subscription'}
          </button>
        </div>
      )}
    </>
  );
}

function ctaLabel(isPro: boolean, loading: boolean): string {
  if (isPro) return 'Current plan';
  if (loading) return 'Loading…';
  return 'Subscribe';
}

function PlanCard({
  title,
  price,
  cadence,
  badge,
  features,
  cta,
  disabled,
  onClick,
  highlight,
}: {
  title: string;
  price: string;
  cadence: string;
  badge?: string;
  features: string[];
  cta: string;
  disabled: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-6 flex flex-col"
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border)'}`,
        boxShadow: highlight ? '0 8px 24px rgba(0,0,0,0.08)' : undefined,
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
          {title}
        </h2>
        {badge && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--accent)', color: '#ffffff' }}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-bold" style={{ color: 'var(--text)' }}>
          {price}
        </span>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {cadence}
        </span>
      </div>
      <ul className="mt-6 space-y-2 flex-1">
        {features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            <span style={{ color: 'var(--accent)' }} aria-hidden>
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity"
        style={{
          background: highlight ? 'var(--accent)' : 'var(--surface)',
          color: highlight ? '#ffffff' : 'var(--text)',
          border: highlight ? 'none' : '1px solid var(--border)',
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {cta}
      </button>
    </div>
  );
}
