import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import ThemeToggle from '@/app/components/ThemeToggle';
import { PricingCards } from './PricingCards';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isPro = false;
  if (user) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .single();
    const status = profile?.subscription_status ?? 'free';
    isPro = status === 'active' || status === 'past_due';
  }

  return (
    <main className="min-h-screen px-4 py-16" style={{ background: 'var(--bg)' }}>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-12">
          <h1
            className="text-4xl sm:text-5xl font-semibold tracking-tight"
            style={{ color: 'var(--text)' }}
          >
            Crawli Pro
          </h1>
          <p className="mt-3 text-base sm:text-lg" style={{ color: 'var(--text-muted)' }}>
            Search 9 resale platforms at once. Find the best price.
          </p>
        </div>

        <PricingCards isSignedIn={!!user} isPro={isPro} />

        <div className="mt-12 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
          <p>Cancel anytime. Searches reset at the start of each billing period.</p>
        </div>
      </div>
    </main>
  );
}
