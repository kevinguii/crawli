'use client';

import { FormEvent, useState } from 'react';
import { PLATFORM_DOMAINS, PLATFORM_NAMES, SearchResponse } from '@/lib/types';

const ALL_PLATFORMS = Object.keys(PLATFORM_DOMAINS);

interface Props {
  onResults: (data: SearchResponse) => void;
  onError: (msg: string) => void;
}

export default function SearchForm({ onResults, onError }: Props) {
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
    if (!query.trim() || selected.length === 0 || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), platforms: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data?.error ?? 'Search failed. Please try again.');
      } else {
        onResults(data as SearchResponse);
      }
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
