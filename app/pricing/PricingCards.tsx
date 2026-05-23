'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type Plan = 'monthly' | 'yearly';

export function PricingCards({ isSignedIn, isPro }: { isSignedIn: boolean; isPro: boolean }) {
  const [billingCycle, setBillingCycle] = useState<Plan>('yearly');
  const [loading, setLoading] = useState<Plan | 'portal' | null>(null);
  const router = useRouter();

  async function handleSubscribe() {
    if (!isSignedIn) {
      router.push('/login?next=/pricing');
      return;
    }
    setLoading(billingCycle);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: billingCycle }),
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

  const proPrice = billingCycle === 'yearly' ? '$8.33' : '$10';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* ── Free plan ── */}
      <div
        className="rounded-xl flex flex-col"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          padding: '1.5rem',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '1.1rem' }}>⚡</span>
          <span className="text-base font-semibold" style={{ color: 'var(--text)' }}>Free</span>
        </div>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Get started at no cost
        </p>

        <hr className="my-4" style={{ borderColor: 'var(--border)' }} />

        {/* Price */}
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-3xl font-bold" style={{ color: 'var(--text)' }}>$0</span>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/monthly</span>
        </div>

        {/* Spacer to match Pro card toggle row */}
        <div style={{ minHeight: '36px', marginBottom: '1rem' }} />

        {/* CTA */}
        <div
          className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-center mb-5"
          style={{
            background: 'var(--surface)',
            color: 'var(--text-dim)',
            border: '1px solid var(--border)',
          }}
        >
          {isPro ? 'Free plan' : 'Current plan'}
        </div>

        {/* Features */}
        <FeatureList
          included={[
            '10 searches per month',
            'Unlimited saves',
            'Watchlist with price alerts',
          ]}
          excluded={['Priority queue']}
        />
      </div>

      {/* ── Pro plan ── */}
      <div
        className="rounded-xl flex flex-col"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--accent)',
          padding: '1.5rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '1.1rem' }}>✦</span>
          <span className="text-base font-semibold" style={{ color: 'var(--text)' }}>Pro</span>
          {isPro && (
            <span
              className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Current plan
            </span>
          )}
        </div>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          More searches, faster results
        </p>

        <hr className="my-4" style={{ borderColor: 'var(--border)' }} />

        {/* Price */}
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-3xl font-bold" style={{ color: 'var(--text)' }}>{proPrice}</span>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/monthly</span>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center gap-3 mb-4" style={{ minHeight: '36px' }}>
          <button
            type="button"
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-lg transition-all duration-200"
            style={{
              background: billingCycle === 'yearly' ? 'var(--accent)' : 'var(--border)',
            }}
            aria-label="Toggle billing cycle"
            role="switch"
            aria-checked={billingCycle === 'yearly'}
          >
            <span
              className="inline-block h-5 w-5 bg-white transition-transform duration-200"
              style={{
                transform: billingCycle === 'yearly' ? 'translateX(1.5rem)' : 'translateX(0.25rem)',
                borderRadius: '5px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              }}
            />
          </button>
          <span className="text-sm" style={{ color: 'var(--text)' }}>
            {billingCycle === 'yearly' ? 'Billed yearly' : 'Billed monthly'}
          </span>
          <span
            className="text-xs font-semibold"
            style={{
              color: billingCycle === 'yearly' ? 'var(--accent)' : 'transparent',
              userSelect: 'none',
            }}
          >
            Save $20
          </span>
        </div>

        {/* CTA */}
        {isPro ? (
          <button
            type="button"
            onClick={handleManage}
            disabled={loading !== null}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity mb-5"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              opacity: loading !== null ? 0.6 : 1,
              cursor: loading !== null ? 'not-allowed' : 'pointer',
            }}
          >
            {loading === 'portal' ? 'Opening…' : 'Manage subscription'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={loading !== null}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity mb-5"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              opacity: loading !== null ? 0.6 : 1,
              cursor: loading !== null ? 'not-allowed' : 'pointer',
            }}
          >
            {loading === billingCycle ? 'Loading…' : 'Subscribe'}
          </button>
        )}

        {/* Features */}
        <FeatureList
          included={[
            '100 searches per month',
            'Unlimited saves',
            'Watchlist with price alerts',
            'Priority queue',
          ]}
        />
      </div>
    </div>
  );
}

function FeatureList({ included, excluded }: { included: string[]; excluded?: string[] }) {
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
      {excluded?.map((f) => (
        <li key={f} className="flex items-start gap-2" style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden style={{ color: 'var(--text-dim)', marginTop: '1px', flexShrink: 0 }}>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
          {f}
        </li>
      ))}
    </ul>
  );
}
