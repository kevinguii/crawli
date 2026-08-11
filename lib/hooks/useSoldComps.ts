'use client';

import { useEffect, useState } from 'react';
import type { SoldCompsResult } from '@/lib/soldComps/types';

/**
 * Fetch sold comps for a query.
 *
 * Fires after results are already on screen, so it never blocks the search render.
 * A failure resolves to null rather than throwing — sold comps are additive, and a
 * dead upstream should leave the rest of the results page untouched.
 */
export function useSoldComps(query: string | null | undefined) {
  const [data, setData] = useState<SoldCompsResult | null>(null);
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
      .then((json: SoldCompsResult | null) => {
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
