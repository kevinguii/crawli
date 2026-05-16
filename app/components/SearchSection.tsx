'use client';

import { useState } from 'react';
import { SearchResponse, SearchStreamEvent } from '@/lib/types';
import SearchForm from './SearchForm';
import SearchProgress, { CheckpointStatus } from './SearchProgress';
import ResultsDisplay from './ResultsDisplay';

interface ProgressState {
  platforms: string[];
  statuses: Record<string, CheckpointStatus>;
  errors: Record<string, string>;
}

export default function SearchSection() {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);

  function handleResults(data: SearchResponse) {
    setError(null);
    setResults(data);
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
      const statuses: Record<string, CheckpointStatus> = {};
      for (const p of event.platforms) statuses[p] = 'loading';
      setProgress({ platforms: event.platforms, statuses, errors: {} });
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
          errors:
            event.status === 'failed' && event.error
              ? { ...prev.errors, [event.platform]: event.error }
              : prev.errors,
        };
      });
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <SearchForm
          onResults={handleResults}
          onError={handleError}
          onProgress={handleProgress}
        />
      </div>

      {progress && (
        <SearchProgress
          platforms={progress.platforms}
          statuses={progress.statuses}
          errors={progress.errors}
        />
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {results && <ResultsDisplay data={results} />}
    </div>
  );
}
