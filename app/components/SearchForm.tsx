'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  PlatformResults,
  SearchResponse,
  SearchStreamEvent,
  SearchHistoryItem,
} from '@/lib/types';
import FilterPanel, {
  emptyFilterState,
  filtersToQuerySuffix,
  FilterState,
} from './FilterPanel';
import { useSearchHistory } from './SearchHistoryProvider';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const PENDING_SEARCH_KEY = 'crawli_pending_search';
// Prefill only (no auto-run) — used by profile dashboard recent searches
const PREFILL_SEARCH_KEY = 'crawli_prefill_search';

const DEFAULT_PLATFORMS = ['grailed', 'mercari', 'depop'];

// ── Query hint detection ──────────────────────────────────────────────────────
// Detect when users type filter criteria (size, color, condition) into the
// search query instead of using the filter dropdowns. Numeric model numbers
// ("jordan 1", "air max 90") are fine; size numbers cause ambiguity.
const FILTER_HINT_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  {
    // "size 10", "size10", standalone US/EU/UK sizes, or clothing size words
    regex: /\bsize\s*\d|\b(xs|xxs|xxl|xxxl|small|medium|large)\b|\b(us|eu|uk)\s*\d|\bsize\b/i,
    label: 'size',
  },
  {
    regex: /\b(black|white|grey|gray|red|blue|green|yellow|pink|purple|brown|tan|navy|olive|beige|cream|gold|silver)\b/i,
    label: 'color',
  },
  {
    regex: /\b(new with tags|nwt|deadstock|like new|pre.?owned|lightly used)\b/i,
    label: 'condition',
  },
];

function detectFilterHints(query: string): string[] {
  const found: string[] = [];
  for (const { regex, label } of FILTER_HINT_PATTERNS) {
    if (regex.test(query)) found.push(label);
  }
  return found;
}

interface Props {
  onResults: (data: SearchResponse, query: string, platforms: string[]) => void;
  onError: (msg: string) => void;
  onProgress: (event: SearchStreamEvent) => void;
  filters: FilterState;
  onFiltersChange: (next: FilterState) => void;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

// Read sessionStorage at init time so query/selected start with the right values
// on the first render, avoiding setState-in-effect cascades.
type SessionInit = {
  query: string;
  platforms: string[];
  filtersOverride: Partial<FilterState> | null;
  autoRun: boolean;
};

function readSessionInit(): SessionInit {
  if (typeof window === 'undefined') {
    return { query: '', platforms: DEFAULT_PLATFORMS, filtersOverride: null, autoRun: false };
  }
  const pendingRaw = sessionStorage.getItem(PENDING_SEARCH_KEY);
  if (pendingRaw) {
    sessionStorage.removeItem(PENDING_SEARCH_KEY);
    try {
      const item = JSON.parse(pendingRaw) as SearchHistoryItem;
      return { query: item.query, platforms: item.platforms, filtersOverride: item.filters ?? null, autoRun: true };
    } catch {}
  }
  const prefillRaw = sessionStorage.getItem(PREFILL_SEARCH_KEY);
  if (prefillRaw) {
    sessionStorage.removeItem(PREFILL_SEARCH_KEY);
    try {
      const item = JSON.parse(prefillRaw) as SearchHistoryItem;
      return { query: item.query, platforms: item.platforms, filtersOverride: item.filters ?? null, autoRun: false };
    } catch {}
  }
  return { query: '', platforms: DEFAULT_PLATFORMS, filtersOverride: null, autoRun: false };
}

export default function SearchForm({ onResults, onError, onProgress, filters, onFiltersChange, abortControllerRef }: Props) {
  const [{ query: initQuery, platforms: initPlatforms, filtersOverride, autoRun }] = useState(readSessionInit);
  const [query, setQuery] = useState(initQuery);
  const [selected, setSelected] = useState<string[]>(initPlatforms);
  const [isLoading, setIsLoading] = useState(false);
  const [quota, setQuota] = useState<{ tier: string; remaining: number; credits: number } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { addSearch } = useSearchHistory();

  // Last-search nudge — only meaningful on the free tier, where the cap (3)
  // is too small for a ratio-based warning to ever fire before exhaustion.
  useEffect(() => {
    fetch('/api/billing/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setQuota({ tier: d.tier ?? d.plan, remaining: Math.max(0, d.cap - d.used), credits: d.credits ?? 0 });
      })
      .catch(() => {});
  }, []);

  // Apply the initial filters override (prop callback, not setState) and
  // trigger auto-submit for searches replayed from history.
  useEffect(() => {
    if (filtersOverride) onFiltersChange({ ...emptyFilterState(), ...filtersOverride });
    if (autoRun) setTimeout(() => formRef.current?.requestSubmit(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load user's saved default platforms from their account settings.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const saved = user?.user_metadata?.default_platforms;
      if (Array.isArray(saved) && saved.length > 0) {
        setSelected(saved);
      }
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const baseQ = query.trim();
    if (isLoading) return;
    if (!baseQ) return;
    if (selected.length === 0) {
      onError('Please select at least one platform before searching.');
      return;
    }

    // Append every active filter (color, category, condition, size) as keywords
    // so each platform's own search index gets the extra signal.
    const suffix = filtersToQuerySuffix(filters);
    const q = suffix ? `${baseQ} ${suffix}` : baseQ;

    setIsLoading(true);
    // Optimistically decrement the nav counter immediately so quota feels instant
    window.dispatchEvent(new CustomEvent('crawli:search-started'));
    setQuota((prev) => {
      if (!prev) return prev;
      // Spend an included search first; once those are gone, draw down a credit.
      return prev.remaining > 0
        ? { ...prev, remaining: prev.remaining - 1 }
        : { ...prev, credits: Math.max(0, prev.credits - 1) };
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const platformsForRun = [...selected];
    const results: Record<string, PlatformResults> = {};

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, platforms: platformsForRun, filters }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let msg = 'Search failed. Please try again.';
        let errorCode: string | undefined;
        let quotaMessage: string | undefined;
        try {
          const data = await res.json();
          errorCode = data?.error;
          quotaMessage = data?.message;
          msg = quotaMessage ?? data?.error ?? msg;
        } catch {}

        // 402 quota_exceeded — show a richer toast with an Upgrade CTA
        // instead of routing through the generic onError red banner.
        if (res.status === 402 && errorCode === 'quota_exceeded') {
          // Included cap + any prepaid credits are both exhausted. Point to
          // settings, where the user can buy a credit pack or upgrade.
          toast.error(quotaMessage ?? 'Search limit reached.', {
            action: {
              label: 'Buy credits',
              onClick: () => { window.location.href = '/settings?from=/search#credits'; },
            },
            duration: 8000,
          });
          return;
        }

        onError(msg);
        return;
      }

      if (!res.body) {
        onError('No response stream from server.');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let priceRange: SearchResponse['priceRange'] = null;
      let averagePrice: SearchResponse['averagePrice'] = null;
      let sawFinal = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let event: SearchStreamEvent;
          try {
            event = JSON.parse(trimmed) as SearchStreamEvent;
          } catch (err) {
            console.error('[search] failed to parse stream line:', trimmed, err);
            continue;
          }
          onProgress(event);
          if (event.type === 'platform_done') {
            results[event.platform] = {
              listings: event.listings,
              count: event.count,
            };
          } else if (event.type === 'final') {
            priceRange = event.priceRange;
            averagePrice = event.averagePrice;
            sawFinal = true;
          }
        }
      }

      if (!sawFinal) {
        onError('Search ended unexpectedly before completing.');
        return;
      }

      // Add to history only on successful search completion.
      void addSearch(baseQ, [...selected].sort(), filters);

      // Ensure every requested platform has an entry, even if no event arrived.
      for (const p of platformsForRun) {
        if (!results[p]) results[p] = { listings: [], count: 0 };
      }

      onResults({
        success: true,
        query: q,
        results,
        priceRange,
        averagePrice,
      }, baseQ, platformsForRun);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        onError('Search cancelled.');
      } else {
        onError('Network error. Please check your connection.');
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }

  const filterHints = detectFilterHints(query);
  // Free tier with no included searches left can still search if they hold
  // prepaid overage credits — only hard-block when both are zero.
  const isExhausted = quota?.tier === 'free' && quota.remaining === 0 && quota.credits === 0;
  const onCredits = quota?.tier === 'free' && quota.remaining === 0 && quota.credits > 0;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a product (e.g. Nike Air Jordan 1 Chicago)"
          disabled={isExhausted}
          className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(226, 75, 74, 0.18)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim() || isExhausted}
          className="rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'linear-gradient(to right, #E24B4A, #D85A30)' }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) e.currentTarget.style.background = 'linear-gradient(to right, #D85A30, #E84D1D)';
          }}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'linear-gradient(to right, #E24B4A, #D85A30)')}
        >
          {isLoading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {quota?.tier === 'free' && quota.remaining === 1 && (
        <p className="text-xs" style={{ color: '#d97706' }}>
          You have one search remaining this week.{' '}
          <Link href="/pricing?from=/search" className="font-semibold underline">
            Upgrade
          </Link>{' '}
          for more.
        </p>
      )}

      {onCredits && (
        <p className="text-xs" style={{ color: '#d97706' }}>
          Weekly searches used. Now using overage credits: {quota?.credits} left.{' '}
          <Link href="/settings#credits" className="font-semibold underline">
            Buy more
          </Link>{' '}
          or{' '}
          <Link href="/pricing?from=/search" className="font-semibold underline">
            upgrade
          </Link>.
        </p>
      )}

      {isExhausted && (
        <p className="text-xs" style={{ color: '#dc2626' }}>
          You have no searches remaining this week.{' '}
          <Link href="/settings#credits" className="font-semibold underline">
            Buy credits
          </Link>{' '}
          or{' '}
          <Link href="/pricing?from=/search" className="font-semibold underline">
            upgrade
          </Link>.
        </p>
      )}

      {filterHints.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Tip: use the <span style={{ color: 'var(--text)' }}>filter dropdowns below</span> for {filterHints.join(', ')}, it improves result accuracy.
        </p>
      )}

      <FilterPanel
        platforms={selected}
        onPlatformsChange={setSelected}
        filters={filters}
        onFiltersChange={onFiltersChange}
      />
    </form>
  );
}
