// Per-platform brand colors. Kept under app/components/ so lib/ stays
// presentation-free.

export const PLATFORM_BG: Record<string, string> = {
  grailed:   '#3A3A3A',
  depop:     '#FF2300',
  stockx:    '#00B341',
  poshmark:  '#9B4C5C',
  ebay:      '#0064D2', // primary eBay blue, used for the shimmer bar only
  mercari:   '#5E6DF2',
  vinted:    '#007782',
  vestiaire: '#C4A17A',
  thredup:   '#5FD3BC',
  realreal:  '#000000',
};

// White for everything; black on vestiaire (light beige bg).
export const PLATFORM_TEXT: Record<string, string> = {
  vestiaire: '#000000',
};
function platformText(platform: string): string {
  return PLATFORM_TEXT[platform] ?? '#FFFFFF';
}

// eBay's 4-stripe gradient (top → bottom): red, blue, yellow, green.
// Each stripe is exactly 25% of the height.
const EBAY_GRADIENT =
  'linear-gradient(to bottom, #E53238 0%, #E53238 25%, #0064D2 25%, #0064D2 50%, #F5AF02 50%, #F5AF02 75%, #86B817 75%, #86B817 100%)';

export interface PlatformStyle {
  background: string;
  color: string;
  isGradient: boolean;
}

export function platformStyle(platform: string): PlatformStyle {
  if (platform === 'ebay') {
    return { background: EBAY_GRADIENT, color: '#FFFFFF', isGradient: true };
  }
  return {
    background: PLATFORM_BG[platform] ?? '#555555',
    color: platformText(platform),
    isGradient: false,
  };
}

// Bar/dot accent color: single solid color per platform for the shimmer bar.
// eBay uses its blue rather than the stripe gradient (too busy at 6px height).
export function platformColor(platform: string, fallback = 'var(--accent)'): string {
  return PLATFORM_BG[platform] ?? fallback;
}
