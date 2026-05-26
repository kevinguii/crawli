'use client';

import { useEffect, useState } from 'react';

export type ThemeSetting = 'light' | 'system' | 'dark';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(setting: ThemeSetting) {
  const resolved = setting === 'system' ? getSystemTheme() : setting;
  document.documentElement.setAttribute('data-theme', resolved);
  try {
    localStorage.setItem('theme', setting);
  } catch {}
}

export function useThemeSetting() {
  const [setting, setSetting] = useState<ThemeSetting>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme') as ThemeSetting | null;
    const valid: ThemeSetting[] = ['light', 'system', 'dark'];
    setSetting(valid.includes(stored as ThemeSetting) ? (stored as ThemeSetting) : 'system');
    setMounted(true);

    // Listen for OS-level changes when in system mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    function onOsChange() {
      const current = localStorage.getItem('theme') as ThemeSetting | null;
      if (!current || current === 'system') {
        applyTheme('system');
      }
    }
    mq.addEventListener('change', onOsChange);
    return () => mq.removeEventListener('change', onOsChange);
  }, []);

  function set(next: ThemeSetting) {
    setSetting(next);
    applyTheme(next);
  }

  return { setting, set, mounted };
}

// Inline 3-way picker used on the Settings page
export function ThemeSelector() {
  const { setting, set, mounted } = useThemeSetting();

  const options: { value: ThemeSetting; label: string; icon: React.ReactNode }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ),
    },
    {
      value: 'system',
      label: 'System',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path strokeLinecap="round" d="M8 21h8M12 17v4" />
        </svg>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
    },
  ];

  if (!mounted) {
    return (
      <div
        className="flex rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        {options.map((o) => (
          <div key={o.value} className="px-3 py-2 w-20 h-9" />
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
    >
      {options.map((o) => {
        const active = setting === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => set(o.value)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
            style={
              active
                ? { background: 'var(--accent)', color: '#fff' }
                : { color: 'var(--text-muted)', background: 'transparent' }
            }
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Legacy default export — kept so any remaining imports don't break at build time.
// It renders nothing; theme is now controlled from Settings.
export default function ThemeToggle() {
  return null;
}
