'use client';

import { RefObject, useLayoutEffect, useState } from 'react';

// For popovers/dropdowns that need to escape a clipping ancestor (e.g. a row
// with overflow-x-auto, or a card with overflow-hidden) by portaling to
// <body> and positioning with `position: fixed` against the trigger element's
// viewport coordinates. Clamps horizontally so the panel never overflows the
// right edge of the screen.
export function useAnchoredPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  panelWidth: number
) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    function update() {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = 8;
      let left = rect.left;
      if (left + panelWidth > window.innerWidth - margin) {
        left = Math.max(margin, rect.right - panelWidth);
      }
      setPos({ top: rect.bottom + 4, left });
    }
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef, panelWidth]);

  return pos;
}
