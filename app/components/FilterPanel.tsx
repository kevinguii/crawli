'use client';

import {
  CSSProperties,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { PLATFORM_DOMAINS, PLATFORM_NAMES } from '@/lib/types';
import { useAnchoredPosition } from '@/lib/hooks/useAnchoredPosition';
import { useScrollEdges, scrollFadeMask } from '@/lib/hooks/useScrollEdges';
import { platformStyle } from './platformColors';
import {
  CATEGORY_OPTIONS,
  CLOTHING_SIZE_OPTIONS,
  COLOR_OPTIONS,
  SHOE_SIZE_OPTIONS,
  type FilterState,
} from '@/lib/filterOptions';

export {
  COLOR_OPTIONS,
  CATEGORY_OPTIONS,
  CLOTHING_SIZE_OPTIONS,
  SHOE_SIZE_OPTIONS,
  SIZE_OPTIONS,
  emptyFilterState,
  filtersToQuerySuffix,
} from '@/lib/filterOptions';
export type { ColorOption, FilterState } from '@/lib/filterOptions';

const DEFAULT_PLATFORMS = ['grailed', 'mercari', 'depop'];
const ALL_PLATFORMS = Object.keys(PLATFORM_DOMAINS).sort((a, b) => {
  const aIdx = DEFAULT_PLATFORMS.indexOf(a);
  const bIdx = DEFAULT_PLATFORMS.indexOf(b);
  if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
  if (aIdx !== -1) return -1;
  if (bIdx !== -1) return 1;
  return a.localeCompare(b);
});

interface Props {
  platforms: string[];
  onPlatformsChange: (next: string[]) => void;
  filters: FilterState;
  onFiltersChange: (next: FilterState) => void;
}

export default function FilterPanel({
  platforms,
  onPlatformsChange,
  filters,
  onFiltersChange,
}: Props) {
  function togglePlatform(key: string) {
    onPlatformsChange(
      platforms.includes(key)
        ? platforms.filter((p) => p !== key)
        : [...platforms, key]
    );
  }
  function setAllPlatforms() {
    onPlatformsChange(ALL_PLATFORMS);
  }
  function clearPlatforms() {
    onPlatformsChange([]);
  }
  function setField<K extends keyof FilterState>(field: K, value: FilterState[K]) {
    const next = { ...filters, [field]: value };
    // Footwear ↔ non-footwear uses different size sets, so clear the stale pick.
    if (field === 'category') {
      const wasFootwear = filters.category === 'footwear';
      const willBeFootwear = value === 'footwear';
      if (wasFootwear !== willBeFootwear) next.size = null;
    }
    onFiltersChange(next);
  }

  const hasSelected = platforms.length > 0;
  const sizeOptions =
    filters.category === 'footwear' ? SHOE_SIZE_OPTIONS : CLOTHING_SIZE_OPTIONS;
  const sizeLabel = filters.category === 'footwear' ? 'Shoe size' : 'Size';

  const platformsRowRef = useRef<HTMLDivElement>(null);
  const platformsEdges = useScrollEdges(platformsRowRef);
  const pillsRowRef = useRef<HTMLDivElement>(null);
  const pillsEdges = useScrollEdges(pillsRowRef);

  return (
    <div className="space-y-3">
      {/* Platform chips: always visible, brand-colored when active.
          Horizontally scrollable on mobile so 8+ chips don't wrap into a wall of rows. */}
      <div
        ref={platformsRowRef}
        className="hide-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible"
        style={{
          WebkitMaskImage: scrollFadeMask(platformsEdges),
          maskImage: scrollFadeMask(platformsEdges),
        }}
      >
        <button
          type="button"
          onClick={hasSelected ? clearPlatforms : setAllPlatforms}
          className="shrink-0 whitespace-nowrap text-xs font-medium underline underline-offset-2 transition-colors"
          style={{ color: 'var(--text-dim)' }}
        >
          {hasSelected ? 'Clear all' : 'Select all'}
        </button>
        {ALL_PLATFORMS.map((p) => {
          const active = platforms.includes(p);
          const ps = platformStyle(p);
          return (
            <label
              key={p}
              className="relative flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                active
                  ? { background: ps.background, color: ps.color, border: '1px solid transparent' }
                  : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }
              }
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={active}
                onChange={() => togglePlatform(p)}
              />
              {active && (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 0 1 1.4-1.4L8.5 12l6.8-6.8a1 1 0 0 1 1.4 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {PLATFORM_NAMES[p] ?? p}
            </label>
          );
        })}
      </div>

      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* Filter pills: always visible, never collapsed.
          Same horizontal-scroll treatment as the platform chips on mobile. */}
      <div
        ref={pillsRowRef}
        className="hide-scrollbar flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
        style={{
          WebkitMaskImage: scrollFadeMask(pillsEdges),
          maskImage: scrollFadeMask(pillsEdges),
        }}
      >
        <FilterDropdown
          label="Category"
          value={filters.category}
          options={CATEGORY_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
          onChange={(v) => setField('category', v)}
        />
        <FilterDropdown
          label={sizeLabel}
          value={filters.size}
          options={sizeOptions.map((o) => ({ key: o.key, label: o.label }))}
          onChange={(v) => setField('size', v)}
        />
        <FilterDropdown
          label="Color"
          value={filters.color}
          options={COLOR_OPTIONS.map((o) => ({
            key: o.key,
            label: o.label,
            leading: (
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{
                  background: o.swatch,
                  boxShadow: o.ring ? `inset 0 0 0 1px ${o.ring}` : undefined,
                }}
              />
            ),
          }))}
          onChange={(v) => setField('color', v)}
        />
        <PriceRangeDropdown
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          onMinChange={(v) => setField('minPrice', v)}
          onMaxChange={(v) => setField('maxPrice', v)}
        />
      </div>

    </div>
  );
}

// ---------- Custom dropdown pill ----------

interface DropdownOption {
  key: string;
  label: string;
  leading?: ReactNode;
}

interface DropdownProps {
  label: string;
  value: string | null;
  options: DropdownOption[];
  onChange: (next: string | null) => void;
}

function FilterDropdown({ label, value, options, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pos = useAnchoredPosition(open, rootRef, 200);

  // Click-outside + Escape to close. Panel is portaled to <body>, so it's no
  // longer a DOM descendant of rootRef, so check both.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = value !== null;
  const selectedLabel =
    value === null ? 'Any' : options.find((o) => o.key === value)?.label ?? 'Any';

  const pillStyle: CSSProperties = active
    ? {
        background: 'var(--surface)',
        border: '1px solid var(--accent)',
        color: 'var(--accent-text)',
      }
    : {
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
      };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors"
        style={pillStyle}
      >
        <span style={{ color: active ? 'var(--accent-text)' : 'var(--text-muted)' }}>
          {label}:
        </span>
        <span>{selectedLabel}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3.5 w-3.5 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path
            fillRule="evenodd"
            d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 0 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Portaled to <body> with fixed positioning: the pill row scrolls
          horizontally on mobile, which clips any absolutely-positioned
          descendant (overflow-x: auto implicitly clips overflow-y too). */}
      {open && pos && createPortal(
        <div
          ref={panelRef}
          className="hide-scrollbar fixed z-50 rounded-xl py-1 shadow-lg"
          style={{
            top: pos.top,
            left: pos.left,
            minWidth: '180px',
            maxWidth: 'calc(100vw - 16px)',
            maxHeight: '170px',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
          }}
        >
          <DropdownItem
            label="Any"
            selected={value === null}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          />
          {options.map((o) => (
            <DropdownItem
              key={o.key}
              label={o.label}
              leading={o.leading}
              selected={value === o.key}
              onClick={() => {
                onChange(value === o.key ? null : o.key);
                setOpen(false);
              }}
            />
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function DropdownItem({
  label,
  selected,
  onClick,
  leading,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  leading?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors"
      style={{
        background: selected ? 'var(--accent-soft)' : 'transparent',
        color: selected ? 'var(--accent-text)' : 'var(--text)',
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = 'var(--surface-hover)';
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = 'transparent';
      }}
    >
      {leading}
      <span>{label}</span>
      {selected && (
        <svg viewBox="0 0 20 20" fill="currentColor" className="ml-auto h-3.5 w-3.5">
          <path
            fillRule="evenodd"
            d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 0 1 1.4-1.4L8.5 12l6.8-6.8a1 1 0 0 1 1.4 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
}

interface PriceRangeDropdownProps {
  minPrice: number | null;
  maxPrice: number | null;
  onMinChange: (value: number | null) => void;
  onMaxChange: (value: number | null) => void;
}

function PriceRangeDropdown({ minPrice, maxPrice, onMinChange, onMaxChange }: PriceRangeDropdownProps) {
  const [open, setOpen] = useState(false);
  const [minRaw, setMinRaw] = useState(minPrice !== null ? String(minPrice) : '');
  const [maxRaw, setMaxRaw] = useState(maxPrice !== null ? String(maxPrice) : '');
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const pos = useAnchoredPosition(open, rootRef, 252);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function parsePrice(raw: string): number | null {
    const n = parseInt(raw, 10);
    return raw.trim() !== '' && !isNaN(n) && n >= 0 ? n : null;
  }

  function handleMinChange(raw: string) {
    const cleaned = raw.replace(/\D/g, '');
    setMinRaw(cleaned);
    const min = parsePrice(cleaned);
    const max = parsePrice(maxRaw);
    if (min !== null && max !== null && min >= max) {
      setError('Min must be less than max');
    } else {
      setError(null);
    }
    onMinChange(min !== null && (max === null || min < max) ? min : null);
  }

  function handleMaxChange(raw: string) {
    const cleaned = raw.replace(/\D/g, '');
    setMaxRaw(cleaned);
    const min = parsePrice(minRaw);
    const max = parsePrice(cleaned);
    if (min !== null && max !== null && min >= max) {
      setError('Min must be less than max');
    } else {
      setError(null);
    }
    onMaxChange(max !== null && (min === null || max > min) ? max : null);
  }

  function handleClear() {
    setMinRaw('');
    setMaxRaw('');
    setError(null);
    onMinChange(null);
    onMaxChange(null);
  }

  const hasValue = minPrice !== null || maxPrice !== null;
  const displayLabel = (() => {
    if (!hasValue) return 'Any';
    if (minPrice !== null && maxPrice !== null) return `$${minPrice}-${maxPrice}`;
    if (minPrice !== null) return `$${minPrice}+`;
    return `up to $${maxPrice}`;
  })();

  const pillStyle: CSSProperties = hasValue
    ? {
        background: 'var(--surface)',
        border: '1px solid var(--accent)',
        color: 'var(--accent-text)',
      }
    : {
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
      };

  const isInvalid = error !== null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors"
        style={pillStyle}
      >
        <span style={{ color: hasValue ? 'var(--accent-text)' : 'var(--text-muted)' }}>
          Price:
        </span>
        <span>{displayLabel}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3.5 w-3.5 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path
            fillRule="evenodd"
            d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 0 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Portaled to <body> with fixed positioning: see FilterDropdown for why
          (the pill row's overflow-x-auto on mobile clips absolute descendants). */}
      {open && pos && createPortal(
        <div
          ref={panelRef}
          className="fixed z-50 rounded-xl p-3 shadow-lg space-y-2"
          style={{
            top: pos.top,
            left: pos.left,
            width: '252px',
            maxWidth: 'calc(100vw - 16px)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
          }}
        >
          <div className="flex gap-2 items-center">
            <div
              className="flex flex-1 items-center gap-1 rounded-lg px-2 py-1.5"
              style={{
                background: 'var(--surface)',
                border: isInvalid
                  ? '1px solid #e53935'
                  : minPrice !== null
                  ? '1px solid var(--accent)'
                  : '1px solid var(--border)',
              }}
            >
              <span className="text-[13px] shrink-0 opacity-60" style={{ color: 'var(--text)' }}>$</span>
              <input
                inputMode="numeric"
                placeholder="Min"
                value={minRaw}
                onChange={(e) => handleMinChange(e.target.value)}
                className="flex-1 bg-transparent text-[13px] outline-none w-0"
                style={{ color: minPrice !== null ? 'var(--accent-text)' : 'var(--text)' }}
              />
            </div>
            <span className="text-[13px] shrink-0 opacity-40" style={{ color: 'var(--text)' }}>{'-'}</span>
            <div
              className="flex flex-1 items-center gap-1 rounded-lg px-2 py-1.5"
              style={{
                background: 'var(--surface)',
                border: isInvalid
                  ? '1px solid #e53935'
                  : maxPrice !== null
                  ? '1px solid var(--accent)'
                  : '1px solid var(--border)',
              }}
            >
              <span className="text-[13px] shrink-0 opacity-60" style={{ color: 'var(--text)' }}>$</span>
              <input
                inputMode="numeric"
                placeholder="Max"
                value={maxRaw}
                onChange={(e) => handleMaxChange(e.target.value)}
                className="flex-1 bg-transparent text-[13px] outline-none w-0"
                style={{ color: maxPrice !== null ? 'var(--accent-text)' : 'var(--text)' }}
              />
            </div>
          </div>
          {error && (
            <p className="text-[11px]" style={{ color: '#e53935' }}>{error}</p>
          )}
          {(minRaw || maxRaw) && !error && (
            <button
              type="button"
              onClick={handleClear}
              className="w-full text-xs font-medium py-1 rounded transition-colors"
              style={{
                background: 'var(--accent-soft)',
                color: 'var(--accent-text)',
              }}
            >
              Clear
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
