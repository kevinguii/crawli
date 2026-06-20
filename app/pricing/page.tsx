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
    <main className="min-h-screen px-4 py-16" style={{ background: 'var(--bg)' }}>
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <PricingCloseButton from={from} />
      </div>
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h1
            className="text-4xl sm:text-5xl font-semibold tracking-tight"
            style={{ color: 'var(--text)' }}
          >
            Crawli
          </h1>
          <p className="mt-3 text-base sm:text-lg" style={{ color: 'var(--text-muted)' }}>
            Search every resale platform at once. Find the best price.
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
