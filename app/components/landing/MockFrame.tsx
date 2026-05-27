import type { ReactNode } from 'react';

export default function MockFrame({
  url,
  children,
  id,
}: {
  url: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className="mock-frame mx-auto max-w-5xl">
      <div
        className="overflow-hidden rounded-2xl"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-strong)',
          boxShadow:
            '0 30px 80px -20px rgba(226,75,74,0.22), 0 10px 30px rgba(0,0,0,0.15)',
        }}
      >
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ background: '#ff5f57' }} />
            <span className="h-3 w-3 rounded-full" style={{ background: '#febc2e' }} />
            <span className="h-3 w-3 rounded-full" style={{ background: '#28c840' }} />
          </div>
          <div
            className="ml-2 flex-1 truncate rounded-md px-3 py-1 text-xs"
            style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}
          >
            {url}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
