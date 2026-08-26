/**
 * Decorative placeholder numbers for paywalled price panels.
 *
 * NEVER derived from real data. The free-tier server response (see
 * /api/sold-comps -> toLockedResult) already strips every real price field
 * before it leaves the server, so these values exist purely to make a blurred
 * backdrop look like a real pricing panel instead of an obviously-empty block.
 * A CSS blur is a presentation choice, not a security boundary. It is always
 * removable via devtools, so the content it sits on top of must never be real
 * in the first place. See LockedOverlay.
 *
 * Deterministic per seed so a panel doesn't visually reshuffle on every
 * re-render; not cryptographic, just stable decoration.
 */

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function fakePriceNumber(seed: string, min = 40, max = 420): number {
  const span = Math.max(1, max - min);
  return min + (hashSeed(seed) % span);
}

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function fakePriceString(seed: string, min?: number, max?: number): string {
  return fmt.format(fakePriceNumber(seed, min, max));
}

import type { LockedPlatformSoldStats, PlatformSoldStats } from './soldComps/types';

/**
 * Fill in a real-but-price-stripped sold-comps row with fabricated numbers, so it
 * can be fed straight into the ordinary SoldCompsPanel as a blurred backdrop.
 *
 * `platform`, `n`, and `windowDays` pass through unchanged: sample size was
 * always safe to reveal (it proves the data exists without being the data), so
 * there's no reason to fake those specifically. Only the figures that are
 * actually the product (price, spread, days to sell) are fabricated.
 */
export function fakeSoldStats(locked: LockedPlatformSoldStats, seedPrefix: string): PlatformSoldStats {
  const median = fakePriceNumber(`${seedPrefix}-${locked.platform}-median`, 40, 420);
  const spread = Math.max(10, Math.round(median * 0.22));
  return {
    platform: locked.platform,
    medianPrice: median,
    p25: Math.max(5, median - spread),
    p75: median + spread,
    n: locked.n,
    windowDays: locked.windowDays,
    daysToSell: fakePriceNumber(`${seedPrefix}-${locked.platform}-days`, 3, 45),
  };
}

