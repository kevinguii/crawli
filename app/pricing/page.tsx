import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';
import { PricingCards } from './PricingCards';
import PricingCloseButton from './PricingCloseButton';
import type { Tier } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Crawli pricing. Start free with no credit card, or upgrade for more monthly searches, daily search alerts and higher result limits across all 8 resale marketplaces.',
  alternates: { canonical: '/pricing' },
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let currentTier: Tier = 'free';
  if (user) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('subscription_status, subscription_tier')
      .eq('id', user.id)
      .single();
    const status = profile?.subscription_status ?? 'free';
    const isPaying = status === 'active' || status === 'past_due';
    currentTier = (profile?.subscription_tier as Tier | null) ?? (isPaying ? 'pro' : 'free');
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-16" style={{ background: 'var(--bg)' }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(226,75,74,0.12), transparent 60%), radial-gradient(ellipse 60% 40% at 85% 10%, rgba(239,159,39,0.08), transparent 60%)',
        }}
      />
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <PricingCloseButton from={from} />
      </div>
      <div className="relative mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: 'var(--accent-soft)',
              color: 'var(--accent-text)',
              border: '1px solid var(--accent-soft)',
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--accent)' }}
            />
            Simple, transparent pricing
          </span>

          <h1
            className="mt-5 text-4xl sm:text-5xl font-semibold tracking-tight"
            style={{ color: 'var(--text)' }}
          >
            Crawli
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base sm:text-lg" style={{ color: 'var(--text-muted)' }}>
            Search every resale platform at once. Find{' '}
            <span
              style={{
                background: 'linear-gradient(to right, #E24B4A, #D85A30, #EF9F27, #FAC775)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontWeight: 600,
              }}
            >
              the best price
            </span>
            .
          </p>
        </div>

        <PricingCards isSignedIn={!!user} currentTier={currentTier} />

        <div className="mt-12 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
          <p>Cancel anytime. Searches reset weekly.</p>
        </div>
      </div>
    </main>
  );
}
