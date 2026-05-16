'use client';

import { ReactNode, useState } from 'react';
import { PLATFORM_DOMAINS, PLATFORM_NAMES } from '@/lib/types';
import { platformStyle } from './platformColors';

const ALL_PLATFORMS = Object.keys(PLATFORM_DOMAINS);

export interface ColorOption {
  key: string;
  label: string;
  swatch: string;
  ring?: string;
}

export const COLOR_OPTIONS: ColorOption[] = [
  { key: 'black',  label: 'Black',  swatch: '#000000' },
  { key: 'white',  label: 'White',  swatch: '#FFFFFF', ring: 'var(--border)' },
  { key: 'gray',   label: 'Gray',   swatch: '#808080' },
  { key: 'red',    label: 'Red',    swatch: '#DC2626' },
  { key: 'orange', label: 'Orange', swatch: '#F97316' },
  { key: 'yellow', label: 'Yellow', swatch: '#EAB308' },
  { key: 'green',  label: 'Green',  swatch: '#16A34A' },
  { key: 'blue',   label: 'Blue',   swatch: '#2563EB' },
  { key: 'purple', label: 'Purple', swatch: '#9333EA' },
  { key: 'pink',   label: 'Pink',   swatch: '#EC4899' },
  { key: 'brown',  label: 'Brown',  swatch: '#7C2D12' },
  { key: 'beige',  label: 'Beige',  swatch: '#D4B896' },
  { key: 'gold',   label: 'Gold',   swatch: '#D4AF37' },
  { key: 'silver', label: 'Silver', swatch: '#C0C0C0', ring: 'var(--border)' },
];

export const CATEGORY_OPTIONS = [
  { key: 'tops',        label: 'Tops' },
  { key: 'bottoms',     label: 'Bottoms' },
  { key: 'outerwear',   label: 'Outerwear' },
  { key: 'footwear',    label: 'Footwear' },
  { key: 'accessories', label: 'Accessories' },
];

export const CONDITION_OPTIONS = [
  { key: 'new',       label: 'New', queryTerm: 'new' },
  { key: 'like-new',  label: 'Like New', queryTerm: 'like new' },
  { key: 'used',      label: 'Used', queryTerm: 'used' },
];

export const CLOTHING_SIZE_OPTIONS = [
  { key: 'xs',  label: 'XS',  queryTerm: 'XS' },
  { key: 's',   label: 'S',   queryTerm: 'size S' },
  { key: 'm',   label: 'M',   queryTerm: 'size M' },
  { key: 'l',   label: 'L',   queryTerm: 'size L' },
  { key: 'xl',  label: 'XL',  queryTerm: 'XL' },
  { key: 'xxl', label: 'XXL', queryTerm: 'XXL' },
];

// Shoe sizes split by men's / women's. Same numeric labels in both — the key +
// query term carry the gender so search engines pick up the distinction.
export const SHOE_SIZE_OPTIONS = [
  { key: 'm8',  label: "Men's 8",  queryTerm: "men's size 8" },
  { key: 'm9',  label: "Men's 9",  queryTerm: "men's size 9" },
  { key: 'm10', label: "Men's 10", queryTerm: "men's size 10" },
  { key: 'm11', label: "Men's 11", queryTerm: "men's size 11" },
  { key: 'm12', label: "Men's 12", queryTerm: "men's size 12" },
  { key: 'w8',  label: "Women's 8",  queryTerm: "women's size 8" },
  { key: 'w9',  label: "Women's 9",  queryTerm: "women's size 9" },
  { key: 'w10', label: "Women's 10", queryTerm: "women's size 10" },
  { key: 'w11', label: "Women's 11", queryTerm: "women's size 11" },
  { key: 'w12', label: "Women's 12", queryTerm: "women's size 12" },
];

// Combined lookup for query-term resolution regardless of which set is active.
export const SIZE_OPTIONS = [...CLOTHING_SIZE_OPTIONS, ...SHOE_SIZE_OPTIONS];

export interface FilterState {
  color: string | null;
  category: string | null;
  condition: string | null;
  size: string | null;
}

export function emptyFilterState(): FilterState {
  return { color: null, category: null, condition: null, size: null };
}

// Build the keyword fragment that should be appended to the user's query.
export function filtersToQuerySuffix(filters: FilterState): string {
  const parts: string[] = [];
  if (filters.color) parts.push(filters.color);
  if (filters.category) parts.push(filters.category);
  if (filters.condition) {
    const c = CONDITION_OPTIONS.find((o) => o.key === filters.condition);
    if (c) parts.push(c.queryTerm);
  }
  if (filters.size) {
    const s = SIZE_OPTIONS.find((o) => o.key === filters.size);
    if (s) parts.push(s.queryTerm);
  }
  return parts.join(' ');
}

function activeFilterCount(platforms: string[], filters: FilterState): number {
  let n = 0;
  if (platforms.length !== ALL_PLATFORMS.length) n += 1;
  if (filters.color) n += 1;
  if (filters.category) n += 1;
  if (filters.condition) n += 1;
  if (filters.size) n += 1;
  return n;
}

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
  const [open, setOpen] = useState(false);

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
  function setField<K extends keyof FilterState>(field: K, value: FilterState[K]) {
    const next = { ...filters, [field]: value };
    // Switching category between footwear and non-footwear invalidates the
    // current size pick (different option sets). Clear it so the user doesn't
    // unknowingly carry over an out-of-range size.
    if (field === 'category') {
      const wasFootwear = filters.category === 'footwear';
      const willBeFootwear = value === 'footwear';
      if (wasFootwear !== willBeFootwear) next.size = null;
    }
    onFiltersChange(next);
  }

  const sizeOptions =
    filters.category === 'footwear' ? SHOE_SIZE_OPTIONS : CLOTHING_SIZE_OPTIONS;

  const count = activeFilterCount(platforms, filters);

  return (
    <div
      className="rounded-xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <span className="flex items-center gap-2">
          <span>Additional configurations</span>
          {count > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: 'var(--accent)', color: '#FFFFFF' }}
            >
              {count}
            </span>
          )}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4 transition-transform duration-200"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          <path
            fillRule="evenodd"
            d="M7.05 4.05a1 1 0 0 1 1.4 0l5.3 5.3a1 1 0 0 1 0 1.4l-5.3 5.3a1 1 0 1 1-1.4-1.4l4.6-4.6-4.6-4.6a1 1 0 0 1 0-1.4z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Smooth slide using the grid 0fr → 1fr trick (no fixed max-height). */}
      <div
        className="grid transition-all duration-300 ease-out"
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
          opacity: open ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <div
            className="space-y-5 px-4 pb-4 pt-4"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            {/* Platforms — multi-select. "All" sets every platform on. */}
            <Section title="Platforms">
              <Chip
                label="All"
                active={platforms.length === ALL_PLATFORMS.length}
                onClick={setAllPlatforms}
              />
              {ALL_PLATFORMS.map((p) => {
                const active = platforms.includes(p);
                const ps = platformStyle(p);
                return (
                  <Chip
                    key={p}
                    label={PLATFORM_NAMES[p] ?? p}
                    active={active}
                    activeStyle={{ background: ps.background, color: ps.color }}
                    onClick={() => togglePlatform(p)}
                  />
                );
              })}
            </Section>

            {/* Color — single-select. "Any" clears the filter. */}
            <Section title="Color">
              <Chip
                label="Any"
                active={filters.color === null}
                onClick={() => setField('color', null)}
              />
              {COLOR_OPTIONS.map((c) => (
                <Chip
                  key={c.key}
                  label={c.label}
                  active={filters.color === c.key}
                  leading={
                    <span
                      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full"
                      style={{
                        background: c.swatch,
                        boxShadow: c.ring ? `inset 0 0 0 1px ${c.ring}` : undefined,
                      }}
                    />
                  }
                  onClick={() =>
                    setField('color', filters.color === c.key ? null : c.key)
                  }
                />
              ))}
            </Section>

            <Section title="Category">
              <Chip
                label="Any"
                active={filters.category === null}
                onClick={() => setField('category', null)}
              />
              {CATEGORY_OPTIONS.map((c) => (
                <Chip
                  key={c.key}
                  label={c.label}
                  active={filters.category === c.key}
                  onClick={() =>
                    setField('category', filters.category === c.key ? null : c.key)
                  }
                />
              ))}
            </Section>

            <Section title="Condition">
              <Chip
                label="Any"
                active={filters.condition === null}
                onClick={() => setField('condition', null)}
              />
              {CONDITION_OPTIONS.map((c) => (
                <Chip
                  key={c.key}
                  label={c.label}
                  active={filters.condition === c.key}
                  onClick={() =>
                    setField('condition', filters.condition === c.key ? null : c.key)
                  }
                />
              ))}
            </Section>

            <Section
              title={
                filters.category === 'footwear' ? 'Shoe size' : 'Clothing size'
              }
            >
              <Chip
                label="Any"
                active={filters.size === null}
                onClick={() => setField('size', null)}
              />
              {sizeOptions.map((s) => (
                <Chip
                  key={s.key}
                  label={s.label}
                  active={filters.size === s.key}
                  onClick={() =>
                    setField('size', filters.size === s.key ? null : s.key)
                  }
                />
              ))}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--text-muted)' }}
      >
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
  leading,
  activeStyle,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  leading?: ReactNode;
  activeStyle?: { background: string; color: string };
}) {
  const style = active
    ? activeStyle ?? { background: 'var(--accent)', color: '#FFFFFF' }
    : { background: 'var(--bg-elevated)', color: 'var(--text)' };
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
      style={{
        ...style,
        border: active ? '1px solid transparent' : '1px solid var(--border)',
      }}
    >
      {leading}
      {label}
    </button>
  );
}
