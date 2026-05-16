'use client';

import { PLATFORM_NAMES } from '@/lib/types';

export type CheckpointStatus = 'loading' | 'done' | 'failed';

interface Props {
  platforms: string[];
  statuses: Record<string, CheckpointStatus>;
  errors: Record<string, string>;
}

export default function SearchProgress({ platforms, statuses, errors }: Props) {
  const total = platforms.length;
  const settled = platforms.filter(
    (p) => statuses[p] === 'done' || statuses[p] === 'failed'
  ).length;
  const fillPct = total === 0 ? 0 : (settled / total) * 100;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">
          {settled === total ? 'Search complete' : 'Searching platforms…'}
        </p>
        <p className="text-xs text-gray-500">
          {settled} / {total}
        </p>
      </div>

      <div className="relative px-3 pt-2 pb-1">
        {/* Track */}
        <div className="absolute left-3 right-3 top-1/2 h-0.5 -translate-y-1/2 bg-gray-200" />
        {/* Fill */}
        <div
          className="absolute left-3 top-1/2 h-0.5 -translate-y-1/2 bg-gray-900 transition-all duration-500"
          style={{ width: `calc((100% - 24px) * ${fillPct / 100})` }}
        />

        <div className="relative flex items-center justify-between">
          {platforms.map((platform) => {
            const status = statuses[platform] ?? 'loading';
            const error = errors[platform];
            return (
              <div key={platform} className="flex flex-col items-center">
                <div
                  title={status === 'failed' && error ? error : undefined}
                  className={[
                    'flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold transition-colors',
                    status === 'loading'
                      ? 'border-gray-300 bg-white text-gray-400 animate-pulse'
                      : '',
                    status === 'done'
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : '',
                    status === 'failed'
                      ? 'border-red-500 bg-red-500 text-white'
                      : '',
                  ].join(' ')}
                >
                  {status === 'done' && (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path
                        fillRule="evenodd"
                        d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {status === 'failed' && (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  {status === 'loading' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                  )}
                </div>
                <span
                  className={[
                    'mt-2 text-[11px] font-medium',
                    status === 'done' ? 'text-gray-900' : '',
                    status === 'failed' ? 'text-red-600' : '',
                    status === 'loading' ? 'text-gray-500' : '',
                  ].join(' ')}
                >
                  {PLATFORM_NAMES[platform] ?? platform}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
