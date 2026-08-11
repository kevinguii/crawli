'use client';

import { useState } from 'react';
import { useSoldComps } from '@/lib/hooks/useSoldComps';
import SoldCompsLookup from '@/app/components/SoldCompsLookup';

export default function PriceCheckPage() {
  const [input, setInput] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const { data, loading } = useSoldComps(submittedQuery || null);

  function check() {
    const q = input.trim();
    if (q) setSubmittedQuery(q);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
        Price Check
      </h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--text)', opacity: 0.65 }}>
        See what an item has actually sold for, per marketplace, and what you&rsquo;d pocket
        after fees if you sold it yourself.
      </p>

      <div className="mt-6">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') check();
          }}
          placeholder="e.g. carhartt wip jacket"
          maxLength={200}
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
        <button
          type="button"
          onClick={check}
          disabled={!input.trim()}
          className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50 sm:w-auto sm:px-6"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          Check price
        </button>
      </div>

      <div className="mt-8">
        <SoldCompsLookup
          query={submittedQuery}
          loading={loading}
          data={data}
          buyLabel="What would you pay for it?"
          buyHelp="We'll factor in marketplace fees and show what you'd actually pocket."
        />
      </div>
    </div>
  );
}
