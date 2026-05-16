'use client';

import { FormEvent, useState } from 'react';
import {
  PLATFORM_DOMAINS,
  PLATFORM_NAMES,
  PlatformResults,
  SearchResponse,
  SearchStreamEvent,
} from '@/lib/types';
import { platformStyle } from './platformColors';

const ALL_PLATFORMS = Object.keys(PLATFORM_DOMAINS);

interface Props {
  onResults: (data: SearchResponse) => void;
  onError: (msg: string) => void;
  onProgress: (event: SearchStreamEvent) => void;
}

export default function SearchForm({ onResults, onError, onProgress }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>(ALL_PLATFORMS);
  const [isLoading, setIsLoading] = useState(false);

  function togglePlatform(platform: string) {
    setSelected((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  }

  function toggleAll() {
    setSelected((prev) => (prev.length === ALL_PLATFORMS.length ? [] : ALL_PLATFORMS));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || selected.length === 0 || isLoading) return;

    setIsLoading(true);

    const platformsForRun = [...selected];
    const results: Record<string, PlatformResults> = {};

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, platforms: platformsForRun }),
      });

      if (!res.ok) {
        let msg = 'Search failed. Please try again.';
        try {
          const data = await res.json();
          msg = data?.error ?? msg;
        } catch {}
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
      });
    } catch {
      onError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }

  const allSelected = selected.length === ALL_PLATFORMS.length;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a product — e.g. Nike Air Jordan 1 Chicago size 10"
          className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim() || selected.length === 0}
          className="rounded-xl px-6 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'var(--accent)' }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--accent-hover)';
          }}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
        >
          {isLoading ? 'Searching…' : 'Search'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs font-medium underline underline-offset-2 transition-colors"
          style={{ color: 'var(--text-dim)' }}
        >
          {allSelected ? 'Clear all' : 'Select all'}
        </button>
        {ALL_PLATFORMS.map((platform) => {
          const active = selected.includes(platform);
          const ps = platformStyle(platform);
          return (
            <label
              key={platform}
              className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                active
                  ? { background: ps.background, color: ps.color, border: '1px solid transparent' }
                  : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }
              }
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={active}
                onChange={() => togglePlatform(platform)}
              />
              {active && (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 0 1 1.4-1.4L8.5 12l6.8-6.8a1 1 0 0 1 1.4 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {PLATFORM_NAMES[platform] ?? platform}
            </label>
          );
        })}
      </div>
    </form>
  );
}
