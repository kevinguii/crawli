'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
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

interface Props {
  onResults: (data: SearchResponse, query: string, platforms: string[]) => void;
  onError: (msg: string) => void;
  onProgress: (event: SearchStreamEvent) => void;
  filters: FilterState;
  onFiltersChange: (next: FilterState) => void;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

export default function SearchForm({ onResults, onError, onProgress, filters, onFiltersChange, abortControllerRef }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>(DEFAULT_PLATFORMS);
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { addSearch } = useSearchHistory();

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

  // Re-run a search queued from /search-history — fills form AND auto-submits.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem(PENDING_SEARCH_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PENDING_SEARCH_KEY);
    try {
      const item = JSON.parse(raw) as SearchHistoryItem;
      setQuery(item.query);
      setSelected(item.platforms);
      onFiltersChange({ ...emptyFilterState(), ...item.filters });
      // Defer submit so child state effects flush first.
      setTimeout(() => formRef.current?.requestSubmit(), 0);
    } catch {
      // ignore malformed payload
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefill a search from the profile dashboard — fills form only, no auto-run.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem(PREFILL_SEARCH_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PREFILL_SEARCH_KEY);
    try {
      const item = JSON.parse(raw) as SearchHistoryItem;
      setQuery(item.query);
      setSelected(item.platforms);
      onFiltersChange({ ...emptyFilterState(), ...item.filters });
    } catch {
      // ignore malformed payload
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          toast.error(quotaMessage ?? 'Search limit reached.', {
            action: {
              label: 'Upgrade',
              onClick: () => { window.location.href = '/pricing'; },
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

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a product (e.g. Nike Air Jordan 1 Chicago size 10)"
          className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
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
          disabled={isLoading || !query.trim()}
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

      <FilterPanel
        platforms={selected}
        onPlatformsChange={setSelected}
        filters={filters}
        onFiltersChange={onFiltersChange}
      />
    </form>
  );
}
