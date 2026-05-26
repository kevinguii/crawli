'use client';

import { useRef, useState } from 'react';
import { SearchResponse, SearchStreamEvent } from '@/lib/types';
import SearchForm from './SearchForm';
import SearchProgress, { CheckpointStatus } from './SearchProgress';
import ResultsDisplay from './ResultsDisplay';
import { FilterState, emptyFilterState } from './FilterPanel';
import CreateAlertModal from './alerts/CreateAlertModal';

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
  const [showAlertModal, setShowAlertModal] = useState(false);

  function handleCancel() {
    abortControllerRef.current?.abort();
  }

  function handleResults(data: SearchResponse, query: string, platforms: string[]) {
    setError(null);
    setResults(data);
    setSearchFilters(filters);
    setLastQuery({ query, platforms });
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

      {results && (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowAlertModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              Save as alert
            </button>
          </div>
          <ResultsDisplay data={results} minPrice={searchFilters?.minPrice} maxPrice={searchFilters?.maxPrice} />
        </>
      )}

      {showAlertModal && lastQuery && (
        <CreateAlertModal
          prefill={lastQuery}
          onClose={() => setShowAlertModal(false)}
          onCreated={() => setShowAlertModal(false)}
        />
      )}
    </div>
  );
}
