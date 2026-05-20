'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useSearchHistory } from './SearchHistoryProvider';
import { platformColor } from './platformColors';
import { PLATFORM_NAMES, type SearchHistoryItem } from '@/lib/types';

interface Props {
  onSelectSearch: (item: SearchHistoryItem) => void;
}

export default function SearchHistoryDropdown({ onSelectSearch }: Props) {
  const { items } = useSearchHistory();

  const visible = items.slice(0, 8);

  return (
    <Link
      href="/search-history"
      className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        color: 'var(--text-muted, var(--text))',
      }}
      title="Search history"
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    </Link>
  );
}
