'use client';

import { useState } from 'react';
import { SearchResponse } from '@/lib/types';
import SearchForm from './SearchForm';
import ResultsDisplay from './ResultsDisplay';

export default function SearchSection() {
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleResults(data: SearchResponse) {
    setError(null);
    setResults(data);
  }

  function handleError(msg: string) {
    setError(msg);
    setResults(null);
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <SearchForm onResults={handleResults} onError={handleError} />
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {results && <ResultsDisplay data={results} />}
    </div>
  );
}
