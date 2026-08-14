'use client';

import { useRouter } from 'next/navigation';
import { useId, useMemo, useRef, useState } from 'react';
import { track } from '@/lib/analytics';

/**
 * Trimmed shape of a compare_items row. The landing page already loads the full
 * catalogue for CompareSection, so this component costs no extra query — the
 * parent just narrows the rows before handing them to the client bundle.
 */
export interface HeroSearchItem {
  slug: string;
  name: string;
  query: string;
  category: string | null;
}

const MAX_RESULTS = 6;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Every token in the input must appear somewhere in the item's haystack, so
 * "chanel flap" matches "Chanel Classic Flap" but "chanel dunk" matches nothing.
 * Deliberately dumber than lib/parse.ts relevance scoring: this is a 33-item
 * catalogue, not a scraped result set.
 */
function matches(tokens: string[], haystack: string): boolean {
  return tokens.every((t) => haystack.includes(t));
}

export default function HeroSearch({ items }: { items: HeroSearchItem[] }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const haystacks = useMemo(
    () =>
      items.map((item) => ({
        item,
        text: normalize(`${item.name} ${item.query} ${item.category ?? ''}`),
      })),
    [items],
  );

  const tokens = useMemo(() => normalize(value).split(' ').filter(Boolean), [value]);

  const results = useMemo(() => {
    if (tokens.length === 0) return [];
    return haystacks
      .filter(({ text }) => matches(tokens, text))
      .slice(0, MAX_RESULTS)
      .map(({ item }) => item);
  }, [haystacks, tokens]);

  const open = focused && tokens.length > 0;
  const hasResults = results.length > 0;

  function go(slug: string) {
    track({ name: 'hero_search', params: { search_term: value.trim(), outcome: 'match' } });
    router.push(`/compare/${slug}`);
  }

  /** No catalogue match: hand the query to the public search page rather than
   *  dead-ending an already-informed visitor on a signup wall. These are the
   *  queries worth turning into new compare_items. */
  function goToSearch() {
    const q = value.trim();
    if (!q) return;
    track({ name: 'hero_search', params: { search_term: q, outcome: 'no_match' } });
    router.push(`/compare/search?q=${encodeURIComponent(q)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      inputRef.current?.blur();
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (hasResults && results[active]) go(results[active].slug);
      else goToSearch();
    }
  }

  return (
    <div className="relative mx-auto mt-7 w-full max-w-xl lg:mx-0">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (hasResults && results[active]) go(results[active].slug);
          else goToSearch();
        }}
      >
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--text-dim)', flexShrink: 0 }}
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            name="q"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setActive(0);
            }}
            onFocus={() => setFocused(true)}
            // Delay so a click on a result lands before the list unmounts.
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            onKeyDown={onKeyDown}
            placeholder="Try “Chanel Classic Flap” or “Jordan 1”"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label="Search resale price comparisons"
            className="w-full bg-transparent text-sm outline-none sm:text-base"
            style={{ color: 'var(--text)' }}
          />
        </div>
      </form>

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl text-left"
          style={{
            // Must be OPAQUE — this floats over page content. `--surface` is
            // rgba(255,255,255,0.04) in dark mode, so using it here let the
            // hero's value pillars show straight through the results.
            // `--bg-elevated` is a solid colour in both themes.
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
          }}
        >
          {hasResults ? (
            results.map((item, i) => (
              <button
                key={item.slug}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item.slug)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors"
                style={{
                  background: i === active ? 'var(--accent-soft)' : 'transparent',
                  color: 'var(--text)',
                }}
              >
                <span className="truncate">{item.name}</span>
                <span
                  className="flex-shrink-0 text-xs"
                  style={{ color: 'var(--text-dim)' }}
                >
                  See prices
                </span>
              </button>
            ))
          ) : (
            <button
              type="button"
              onClick={goToSearch}
              className="flex w-full flex-col gap-1 px-4 py-3 text-left"
              style={{ background: 'var(--accent-soft)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Search “{value.trim()}” across 9 marketplaces
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Not one of our daily comparisons yet. Run it live instead.
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
