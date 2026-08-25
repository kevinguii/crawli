import { pickShareCardListing, buildShareCardUrl, type ShareCardData } from '@/lib/shareCard';
import type { Listing } from '@/lib/types';

let failures = 0;
function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? '  PASS' : '  FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failures++;
}

function listing(over: Partial<Listing> = {}): Listing {
  return {
    id: over.id ?? Math.random().toString(36),
    title: over.title ?? 'Carhartt WIP jacket',
    price: over.price !== undefined ? over.price : 50,
    currency: over.currency ?? 'USD',
    condition: null,
    size: null,
    color: null,
    seller: null,
    url: over.url ?? 'https://example.com/listing',
    image: over.image !== undefined ? over.image : 'https://example.com/photo.jpg',
    platform: over.platform ?? 'grailed',
  };
}

console.log('\n=== pickShareCardListing ===');

{
  const result = pickShareCardListing('carhartt wip jacket', {});
  check('empty results returns null', result === null);
}

{
  const results = {
    grailed: { count: 2, listings: [listing({ price: null }), listing({ price: null })] },
  };
  const result = pickShareCardListing('carhartt wip jacket', results);
  check('all-null-price results returns null', result === null);
}

{
  const usdListing = listing({ id: 'usd-50', price: 50, currency: 'USD', platform: 'grailed' });
  // EUR rate is 1.17 in lib/currency.ts: 40 EUR -> $46.80, cheaper than the $50 USD listing.
  const eurListing = listing({ id: 'eur-40', price: 40, currency: 'EUR', platform: 'vinted' });
  const results = {
    grailed: { count: 1, listings: [usdListing] },
    vinted: { count: 1, listings: [eurListing] },
  };
  const result = pickShareCardListing('carhartt wip jacket', results);
  check('cross-currency cheapest picked correctly', result?.listing.id === 'eur-40', `got ${result?.listing.id}`);
  check('totalCount sums per-platform count', result?.totalCount === 2, `got ${result?.totalCount}`);
  check('platformCount counts both platforms', result?.platformCount === 2, `got ${result?.platformCount}`);
  check('query is carried through', result?.query === 'carhartt wip jacket');
}

{
  const results = {
    grailed: { count: 1, listings: [listing({ id: 'g1' })] },
    stockx: { count: 0, listings: [] },
  };
  const result = pickShareCardListing('carhartt wip jacket', results);
  check('zero-count platform excluded from platformCount', result?.platformCount === 1, `got ${result?.platformCount}`);
  check('zero-count platform still included in totalCount sum', result?.totalCount === 1, `got ${result?.totalCount}`);
}

{
  const badCurrency = listing({ id: 'xxx', price: 1, currency: 'XXX', platform: 'grailed' });
  const goodListing = listing({ id: 'usd-50', price: 50, currency: 'USD', platform: 'grailed' });
  const results = { grailed: { count: 2, listings: [badCurrency, goodListing] } };
  const result = pickShareCardListing('carhartt wip jacket', results);
  check('unconvertible currency is skipped, valid one still picked', result?.listing.id === 'usd-50', `got ${result?.listing.id}`);
}

{
  // A listing with no photo must still be shareable -- the route renders a placeholder.
  const results = { grailed: { count: 1, listings: [listing({ id: 'nopic', image: null })] } };
  const result = pickShareCardListing('carhartt wip jacket', results);
  check('listing with null image is still eligible', result?.listing.id === 'nopic');
}

console.log('\n=== buildShareCardUrl ===');

{
  const data: ShareCardData = {
    query: 'bape & supreme',
    totalCount: 12,
    platformCount: 3,
    listing: listing({ title: '100% Authentic "Bape" Hoodie #1', price: 45, currency: 'USD', platform: 'depop' }),
  };
  const url = buildShareCardUrl(data);
  check('starts with the route path', url.startsWith('/api/share-card?'), url);
  const parsed = new URL(url, 'http://localhost');
  check('query param round-trips', parsed.searchParams.get('query') === 'bape & supreme');
  check('title param round-trips special chars', parsed.searchParams.get('title') === '100% Authentic "Bape" Hoodie #1');
  check('count param round-trips as string', parsed.searchParams.get('count') === '12');
  check('platforms param round-trips as string', parsed.searchParams.get('platforms') === '3');
  check('price param round-trips', parsed.searchParams.get('price') === '45');
  check('currency param round-trips', parsed.searchParams.get('currency') === 'USD');
  check('platform param round-trips', parsed.searchParams.get('platform') === 'depop');
}

{
  const data: ShareCardData = {
    query: 'test',
    totalCount: 1,
    platformCount: 1,
    listing: listing({ image: null }),
  };
  const parsed = new URL(buildShareCardUrl(data), 'http://localhost');
  check('null image serializes to empty string', parsed.searchParams.get('image') === '');
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);
