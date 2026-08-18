'use client';

import { useEffect, useState } from 'react';
import type { SoldCompsResult, LockedSoldCompsResult } from '@/lib/soldComps/types';

/**
 * What /api/sold-comps returns. Free users get the locked variant, which carries
 * platform names and sample sizes but no prices — the stripping happens server
 * side, so this union is the honest shape of the response, not a UI convenience.
 * Narrow with `data.locked === true` before reading any price field.
 */
export type SoldCompsResponse = SoldCompsResult | LockedSoldCompsResult;

/**
 * Fetch sold comps for a query.
 *
 * Fires after results are already on screen, so it never blocks the search render.
 * A failure resolves to null rather than throwing — sold comps are additive, and a
 * dead upstream should leave the rest of the results page untouched.
 */
export function useSoldComps(query: string | null | undefined) {
  const [data, setData] = useState<SoldCompsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query?.trim();
    if (!q) {
      setData(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setData(null);

    fetch('/api/sold-comps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: SoldCompsResponse | null) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [query]);

  return { data, loading };
}
