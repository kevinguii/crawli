'use client';

import { RefObject, useEffect, useState } from 'react';

interface ScrollEdges {
  left: boolean;
  right: boolean;
}

// Tracks whether a horizontally-scrollable element has more content hidden
// past its left/right edge, so the UI can hint "there's more to scroll" —
// otherwise overflow-x-auto rows give no visual cue they're scrollable.
export function useScrollEdges(ref: RefObject<HTMLElement | null>): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function update() {
      if (!el) return;
      setEdges({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    }
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [ref]);

  return edges;
}

const FADE = '24px';

// CSS mask (not a flat-color overlay) so it fades correctly over any
// background, including gradients — only the row's own content fades out,
// the background underneath stays untouched.
export function scrollFadeMask(edges: ScrollEdges): string | undefined {
  if (edges.left && edges.right) {
    return `linear-gradient(to right, transparent, black ${FADE}, black calc(100% - ${FADE}), transparent)`;
  }
  if (edges.right) {
    return `linear-gradient(to right, black calc(100% - ${FADE}), transparent)`;
  }
  if (edges.left) {
    return `linear-gradient(to right, transparent, black ${FADE})`;
  }
  return undefined;
}
