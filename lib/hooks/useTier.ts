'use client';

import { useEffect, useState } from 'react';
import type { Tier } from '@/lib/tierCaps';

/**
 * The current user's plan tier, for gating UI.
 *
 * This is a *presentation* signal only. Never treat it as the enforcement point:
 * anything genuinely paid is gated server-side (see /api/sold-comps, which strips
 * prices from the payload rather than trusting the client to hide them).
 *
 * The in-flight promise is shared at module scope so several gated components
 * mounting in the same render — the price summary, a locked panel, an upgrade
 * banner — cost one request between them rather than one each.
 */
let inflight: Promise<Tier> | null = null;

function fetchTier(): Promise<Tier> {
  if (!inflight) {
    inflight = fetch('/api/billing/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { tier?: Tier } | null) => json?.tier ?? 'free')
      // Fail closed. A billing endpoint that is down should not hand out the paid
      // view of the UI; the server gate would withhold the data anyway, so an
      // optimistic guess here would just render an empty paid panel.
      .catch(() => 'free' as Tier)
      .finally(() => {
        // Let a later mount re-check, e.g. after the user upgrades in another tab.
        setTimeout(() => { inflight = null; }, 30_000);
      });
  }
  return inflight;
}

export function useTier(): { tier: Tier | null; loading: boolean } {
  const [tier, setTier] = useState<Tier | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTier().then((t) => {
      if (!cancelled) setTier(t);
    });
    return () => { cancelled = true; };
  }, []);

  return { tier, loading: tier === null };
}
