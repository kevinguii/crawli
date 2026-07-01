'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Wraps a section and fades + lifts it in the first time it scrolls into view.
 * Respects prefers-reduced-motion (and missing IntersectionObserver) by
 * rendering fully visible immediately — so content is never stuck hidden.
 */
export default function Reveal({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(16px)',
        transition: 'opacity 500ms ease-out, transform 500ms ease-out',
      }}
    >
      {children}
    </div>
  );
}
