// Per-platform accent colors. Picked to be distinguishable on both dark and
// light themes; brand-adjacent without being literal. Kept here (not in
// lib/types) so lib/ stays presentation-free.
export const PLATFORM_COLORS: Record<string, string> = {
  grailed: '#ef4444',    // red
  depop: '#ec4899',      // pink
  stockx: '#22c55e',     // green
  poshmark: '#e11d48',   // rose
  ebay: '#eab308',       // yellow
  mercari: '#f97316',    // orange
  vinted: '#14b8a6',     // teal
  vestiaire: '#a855f7',  // purple
};

export function platformColor(platform: string, fallback = 'var(--accent)'): string {
  return PLATFORM_COLORS[platform] ?? fallback;
}
