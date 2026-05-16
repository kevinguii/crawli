'use client';

import { FormEvent, useState } from 'react';
import {
  PLATFORM_DOMAINS,
  PLATFORM_NAMES,
  PlatformResults,
  SearchResponse,
  SearchStreamEvent,
} from '@/lib/types';

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
      {/* Query input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Nike Air Jordan 1 Chicago size 10"
          className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim() || selected.length === 0}
          className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {/* Platform checkboxes */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs font-medium text-gray-500 hover:text-gray-800 underline underline-offset-2"
        >
          {allSelected ? 'Clear all' : 'Select all'}
        </button>
        {ALL_PLATFORMS.map((platform) => (
          <label
            key={platform}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
              selected.includes(platform)
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
            }`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={selected.includes(platform)}
              onChange={() => togglePlatform(platform)}
            />
            {PLATFORM_NAMES[platform] ?? platform}
          </label>
        ))}
      </div>
    </form>
  );
}
