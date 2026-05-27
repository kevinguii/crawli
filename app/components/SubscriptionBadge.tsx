'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type BillingStatus = {
  status: string;
  plan: 'free' | 'pro';
  used: number;
  cap: number;
  periodEnd: string | null;
};

export default function SubscriptionBadge() {
  const [data, setData] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/billing/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    const onSearchStarted = () => {
      setData((prev) => prev ? { ...prev, used: Math.min(prev.used + 1, prev.cap) } : prev);
    };
    window.addEventListener('crawli:search-started', onSearchStarted);

    return () => {
      cancelled = true;
      window.removeEventListener('crawli:search-started', onSearchStarted);
    };
  }, []);

  if (loading || !data) return null;

  const remaining = Math.max(0, data.cap - data.used);
  const ratio = data.used / data.cap;
  const isFree = data.plan === 'free';

  // Only show counter once the user is in the red zone (≥90% used) or fully exhausted.
  const showCounter = ratio >= 0.9;

  if (!showCounter) return null;

  // Color: red when exhausted, amber when approaching.
  const counterColor = ratio >= 1 ? 'var(--error, #dc2626)' : '#d97706';

  return (
    <div className="flex items-center gap-2">
      <span
        className="hidden sm:inline text-xs font-medium tabular-nums"
        style={{ color: counterColor }}
        title={`${data.used} of ${data.cap} searches used${
          isFree ? ' this month' : ' this billing period'
        }`}
      >
        {remaining}/{data.cap}
      </span>
      {isFree && (
        <Link
          href="/pricing"
          className="text-xs font-semibold rounded-full px-2.5 py-1 transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)', color: '#ffffff' }}
        >
          Upgrade
        </Link>
      )}
    </div>
  );
}
