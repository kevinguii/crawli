'use client';

import { useRef, useState } from 'react';
import { SearchResponse, SearchStreamEvent } from '@/lib/types';
import SearchForm from './SearchForm';
import SearchProgress, { CheckpointStatus } from './SearchProgress';
import ResultsDisplay from './ResultsDisplay';
import { FilterState, emptyFilterState } from './FilterPanel';

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

  function handleCancel() {
    abortControllerRef.current?.abort();
  }

  function handleResults(data: SearchResponse) {
    setError(null);
    setResults(data);
    setSearchFilters(filters);
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

      {results && <ResultsDisplay data={results} minPrice={searchFilters?.minPrice} maxPrice={searchFilters?.maxPrice} />}
    </div>
  );
}
