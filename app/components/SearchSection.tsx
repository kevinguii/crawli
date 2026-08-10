'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchResponse, SearchStreamEvent } from '@/lib/types';
import SearchForm from './SearchForm';
import SearchProgress, { CheckpointStatus } from './SearchProgress';
import ResultsDisplay from './ResultsDisplay';
import AlertCtaBanner from './AlertCtaBanner';
import { FilterState, emptyFilterState } from './FilterPanel';

/** Case/whitespace-insensitive match, so "Nike  Dunk" finds an alert on "nike dunk". */
function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

interface ProgressState {
  platforms: string[];
  statuses: Record<string, CheckpointStatus>;
  errors: Record<string, string>;
  counts: Record<string, number>;
}

export default function SearchSection() {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [filters, setFilters] = useState<FilterState>(emptyFilterState());
  const [searchFilters, setSearchFilters] = useState<FilterState | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [lastQuery, setLastQuery] = useState<{ query: string; platforms: string[] } | null>(null);
  const [nativeResultsCap, setNativeResultsCap] = useState<number | null>(null);
  const router = useRouter();
  // Whether an alert already covers the query just run — flips the CTA above the
  // results from a pitch to a quiet confirmation.
  const [hasAlert, setHasAlert] = useState(false);

  function handleCancel() {
    abortControllerRef.current?.abort();
  }

  function handleResults(data: SearchResponse, query: string, platforms: string[]) {
    setError(null);
    setResults(data);
    setSearchFilters(filters);
    setLastQuery({ query, platforms });

    // Reuse the existing alerts list endpoint rather than adding one; the user's
    // alert count is capped at 20 on the largest tier, so this is a small read.
    const target = normalizeQuery(query);
    fetch('/api/saved-searches')
      .then((r) => (r.ok ? r.json() : null))
      .then((alerts) => {
        if (!Array.isArray(alerts)) return;
        setHasAlert(alerts.some((a) => normalizeQuery(a?.query ?? '') === target));
      })
      .catch(() => {});
  }

  // Creating an alert happens on /alerts, not in a modal over the results. The
  // alerts page is where the alert then lives, so the user lands somewhere that
  // makes sense afterwards instead of being dropped back on a stale result grid.
  // Query and platforms ride along so the form opens pre-filled.
  function goCreateAlert() {
    if (!lastQuery) return;
    const params = new URLSearchParams({
      new: '1',
      query: lastQuery.query,
      platforms: lastQuery.platforms.join(','),
    });
    router.push(`/alerts?${params.toString()}`);
  }

  function handleError(msg: string) {
    setError(msg);
    setResults(null);
    setProgress(null);
  }

  function handleProgress(event: SearchStreamEvent) {
    if (event.type === 'start') {
      setResults(null);
      setError(null);
      setSearchFilters(null);
      setHasAlert(false);
      setNativeResultsCap(event.nativeResultsCap);
      const statuses: Record<string, CheckpointStatus> = {};
      for (const p of event.platforms) statuses[p] = 'loading';
      setProgress({ platforms: event.platforms, statuses, errors: {}, counts: {} });
      return;
    }
    if (event.type === 'platform_done') {
      setProgress((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          statuses: {
            ...prev.statuses,
            [event.platform]: event.status === 'ok' ? 'done' : 'failed',
          },
          counts: { ...prev.counts, [event.platform]: event.count },
          errors:
            event.status === 'failed' && event.error
              ? { ...prev.errors, [event.platform]: event.error }
              : prev.errors,
        };
      });
    }
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'var(--search-container-bg)',
          border: '1px solid transparent',
          backgroundClip: 'padding-box',
          boxShadow: '0 0 0 1px rgba(226, 75, 74, 0.28), inset 0 1px 0 rgba(250, 199, 117, 0.08)',
        }}
      >
        <SearchForm
          onResults={handleResults}
          onError={handleError}
          onProgress={handleProgress}
          filters={filters}
          onFiltersChange={setFilters}
          abortControllerRef={abortControllerRef}
        />
      </div>

      {progress && (
        <SearchProgress
          platforms={progress.platforms}
          statuses={progress.statuses}
          errors={progress.errors}
          counts={progress.counts}
          nativeResultsCap={nativeResultsCap}
          onCancel={handleCancel}
        />
      )}

      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: 'var(--danger-soft)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
          }}
        >
          {error}
        </div>
      )}

      {results && (
        <>
          {lastQuery && (
            <AlertCtaBanner
              query={lastQuery.query}
              hasAlert={hasAlert}
              onCreateAlert={goCreateAlert}
            />
          )}
          <ResultsDisplay
            data={results}
            minPrice={searchFilters?.minPrice}
            maxPrice={searchFilters?.maxPrice}
          />
        </>
      )}
    </div>
  );
}
