export type MockListing = {
  platform: string;
  title: string;
  price: string;
  size: string;
  lowest?: boolean;
};

export type MockSearch = {
  id: string;
  query: string;
  chipLabel: string;
  results: MockListing[];
};

// Curated representative listings per query.
// Six per search → first 2 render sharp, remaining 4 blurred + sign-up gate.
// Data is hand-picked to feel realistic; not a live scrape.
export const POPULAR_SEARCHES: MockSearch[] = [
  {
    id: 'stussy',
    query: 'stussy world tour hoodie',
    chipLabel: 'Stussy hoodie',
    results: [
      { platform: 'depop', title: 'Stüssy World Tour Hoodie Black', price: '$68', size: 'M', lowest: true },
      { platform: 'grailed', title: 'Stussy World Tour Pullover Hoodie', price: '$74', size: 'M' },
      { platform: 'vinted', title: 'Stussy World Tour Hoodie Charcoal', price: '$82', size: 'M' },
      { platform: 'mercari', title: 'Stussy WT Hoodie Faded Black', price: '$95', size: 'M' },
      { platform: 'poshmark', title: 'Stussy World Tour Hoodie SS22', price: '$110', size: 'M' },
      { platform: 'ebay', title: 'Stussy World Tour Pullover Hooded Sweatshirt', price: '$118', size: 'M' },
    ],
  },
  {
    id: 'tabi',
    query: 'margiela tabi 39',
    chipLabel: 'Margiela Tabi 39',
    results: [
      { platform: 'depop', title: 'Maison Margiela Tabi Mary Jane Black 39', price: '$420', size: '39', lowest: true },
      { platform: 'grailed', title: 'MM6 Margiela Tabi Ballet Flats EU 39', price: '$465', size: '39' },
      { platform: 'vinted', title: 'Maison Margiela Tabi Leather Flats 39', price: '$490', size: '39' },
      { platform: 'poshmark', title: 'Margiela Tabi Mary Jane Size 39 Black', price: '$540', size: '39' },
      { platform: 'ebay', title: 'Maison Margiela Tabi Split-Toe Flats 39', price: '$575', size: '39' },
      { platform: 'mercari', title: 'MM Tabi Mary Jane Black EU 39', price: '$610', size: '39' },
    ],
  },
  {
    id: 'fog',
    query: 'fear of god essentials hoodie',
    chipLabel: 'FOG Essentials',
    results: [
      { platform: 'grailed', title: 'Fear of God Essentials Hoodie — Iron', price: '$82', size: 'M', lowest: true },
      { platform: 'depop', title: 'Essentials Pullover Hoodie Black M', price: '$95', size: 'M' },
      { platform: 'poshmark', title: 'FOG Essentials Hoodie SS22 Stretch Limo', price: '$110', size: 'M' },
      { platform: 'stockx', title: 'Fear of God Essentials Hoodie Iron', price: '$128', size: 'M' },
      { platform: 'mercari', title: 'Essentials Hoodie Stretch Limo Medium', price: '$135', size: 'M' },
      { platform: 'vinted', title: 'Fear of God Essentials Pullover Black', price: '$142', size: 'M' },
    ],
  },
  {
    id: 'nike-shorts',
    query: 'nike basketball shorts',
    chipLabel: 'Nike basketball shorts',
    results: [
      { platform: 'mercari', title: 'Nike Dri-Fit Basketball Shorts Black L', price: '$14', size: 'L', lowest: true },
      { platform: 'poshmark', title: 'Nike Icon 11" Basketball Shorts Mens L', price: '$18', size: 'L' },
      { platform: 'ebay', title: 'Nike Dri-FIT Icon Basketball Shorts Large Black', price: '$22', size: 'L' },
      { platform: 'depop', title: 'Vintage Nike Basketball Shorts Y2K Black L', price: '$28', size: 'L' },
      { platform: 'vinted', title: 'Nike Dri-Fit Shorts Mesh Lined Black', price: '$25', size: 'L' },
      { platform: 'grailed', title: 'Nike DRI-FIT Mesh Basketball Shorts', price: '$32', size: 'L' },
    ],
  },
  {
    id: 'levis',
    query: "levi's 501 jeans 32x32",
    chipLabel: "Levi's 501",
    results: [
      { platform: 'depop', title: "Levi's 501 Original Fit Jeans Dark Wash 32x32", price: '$32', size: '32x32', lowest: true },
      { platform: 'poshmark', title: "Levi's 501 Straight Leg Jeans Mens 32x32", price: '$38', size: '32x32' },
      { platform: 'mercari', title: "Levis 501 Button Fly Dark Indigo 32 32", price: '$42', size: '32x32' },
      { platform: 'ebay', title: "Levi's 501 Original Jeans Medium Wash Mens 32x32", price: '$45', size: '32x32' },
      { platform: 'vinted', title: "Vintage Levi's 501 Made in USA Dark Wash 32", price: '$58', size: '32x32' },
      { platform: 'grailed', title: "Levi's Vintage Clothing 501 1955 32x32", price: '$110', size: '32x32' },
    ],
  },
  {
    id: 'patagonia',
    query: 'patagonia retro pile fleece',
    chipLabel: 'Patagonia fleece',
    results: [
      { platform: 'depop', title: 'Patagonia Retro Pile Fleece Jacket Natural M', price: '$78', size: 'M', lowest: true },
      { platform: 'grailed', title: 'Patagonia Retro-X Fleece Pullover Medium', price: '$92', size: 'M' },
      { platform: 'poshmark', title: 'Patagonia Synchilla Snap-T Pullover Mens M', price: '$95', size: 'M' },
      { platform: 'mercari', title: 'Patagonia Retro Pile Jacket Stonewash Medium', price: '$105', size: 'M' },
      { platform: 'ebay', title: 'Patagonia Classic Retro-X Fleece Natural M', price: '$120', size: 'M' },
      { platform: 'vinted', title: 'Patagonia Retro Pile Fleece Bear Brown M', price: '$135', size: 'M' },
    ],
  },
];

export const DEFAULT_MOCK = POPULAR_SEARCHES[2]; // FOG essentials

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Find best match by counting shared tokens (>=2 tokens, or chip id match).
// Returns null when no curated match — caller falls back to a generic echo.
export function findMockMatch(query: string): MockSearch | null {
  const q = normalize(query);
  if (!q) return null;
  for (const m of POPULAR_SEARCHES) {
    if (q === m.id || q === normalize(m.query) || q === normalize(m.chipLabel)) {
      return m;
    }
  }
  const qTokens = new Set(q.split(' ').filter((t) => t.length >= 3));
  let best: { m: MockSearch; score: number } | null = null;
  for (const m of POPULAR_SEARCHES) {
    const mTokens = new Set(normalize(m.query).split(' '));
    let score = 0;
    qTokens.forEach((t) => {
      if (mTokens.has(t)) score++;
    });
    if (score >= 2 && (!best || score > best.score)) {
      best = { m, score };
    }
  }
  return best?.m ?? null;
}
