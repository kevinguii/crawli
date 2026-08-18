'use client';

import { useMemo } from 'react';
import SoldCompsPanel from './SoldCompsPanel';
import LockedOverlay from './LockedOverlay';
import { fakeSoldStats } from '@/lib/fakePricing';
import type { LockedPlatformSoldStats, PlatformSoldStats } from '@/lib/soldComps/types';
import type { PaywallSurface } from '@/lib/analytics';

/**
 * The free-tier view of sold comps: a blurred backdrop built from fabricated
 * numbers, with a crisp upgrade prompt on top.
 *
 * `platforms` here is already the server-stripped shape (see /api/sold-comps and
 * lib/soldComps/types.toLockedResult) — no price, spread, or days-to-sell exists
 * anywhere upstream of this component. `fakeSoldStats` fills those in with
 * decoration and passes the real platform/n/windowDays through unchanged, so the
 * ordinary SoldCompsPanel can render it exactly like the unlocked view before
 * LockedOverlay blurs it. See LockedOverlay for why the blur itself is safe.
 */
export default function SoldCompsLockedPanel({
  platforms,
  query,
  surface,
}: {
  platforms: LockedPlatformSoldStats[];
  query: string;
  surface: PaywallSurface;
}) {
  const fakeStats: PlatformSoldStats[] = useMemo(
    () => platforms.map((p) => fakeSoldStats(p, query)),
    [platforms, query],
  );

  if (fakeStats.length === 0) return null;

  return (
    <LockedOverlay
      surface={surface}
      title="We found sold prices for this one."
      body="Pro shows the median sale price, the typical range, and how fast these move."
    >
      <SoldCompsPanel platforms={fakeStats} selected={null} onSelect={() => {}} />
    </LockedOverlay>
  );
}
