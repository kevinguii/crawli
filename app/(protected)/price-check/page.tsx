'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSoldComps } from '@/lib/hooks/useSoldComps';
import SoldCompsLookup from '@/app/components/SoldCompsLookup';

/** This page is where the full list lives, so it renders every row the API sends
 *  (bounded server-side by SALES_ROW_CAP). The search results panel links here. */
const FULL_SALES_LIMIT = 50;

function PriceCheck({ initialQuery }: { initialQuery: string }) {
  const [input, setInput] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const { data, loading } = useSoldComps(submittedQuery || null);

  function check() {
    const q = input.trim();
    if (q) setSubmittedQuery(q);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
        Price Check
      </h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--text)', opacity: 0.65 }}>
        See what an item has been selling for, per marketplace, and what you&rsquo;d pocket
        after fees if you sold it yourself.
      </p>

      <div className="mt-6 max-w-2xl">
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
          buyLabel="Cost to buy"
          buyHelp="We'll factor in marketplace fees and show what you'd actually pocket."
          surface="price_check"
          variant="tabbed"
          salesLimit={FULL_SALES_LIMIT}
          salesInitialVisible={10}
          marginDefaultOpen
        />
      </div>
    </div>
  );
}

/**
 * `?q=` is how the search results panel hands a query over ("See them all in Price
 * Check"), so arriving with one runs the lookup rather than just prefilling the box.
 *
 * The param is passed as a key, not synced into state with an effect: following the
 * link a second time with a different item then remounts the form cleanly, and the
 * typed-query state can't go stale against the URL.
 */
function PriceCheckFromUrl() {
  const q = (useSearchParams().get('q') ?? '').trim();
  return <PriceCheck key={q} initialQuery={q} />;
}

export default function PriceCheckPage() {
  // useSearchParams needs a Suspense boundary above it, or the whole route opts
  // into client-side rendering at build time.
  return (
    <Suspense fallback={null}>
      <PriceCheckFromUrl />
    </Suspense>
  );
}
