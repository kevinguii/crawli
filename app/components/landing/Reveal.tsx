'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Wraps a section and lifts it into place the first time it scrolls into view.
 * Content is always opacity:1 (including in the server-rendered HTML), so a
 * bot, crawler, screenshot, or a user who never scrolls just right always sees
 * real content, never a blank section. Only the transform animates.
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
        transform: shown ? 'none' : 'translateY(16px)',
        transition: 'transform 500ms ease-out',
      }}
    >
      {children}
    </div>
  );
}
