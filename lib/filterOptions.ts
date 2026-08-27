// Filter option tables and FilterState shape, extracted from FilterPanel so
// they can be imported by server-side code (api route, scrapers) without
// pulling in the React component.

export interface ColorOption {
  key: string;
  label: string;
  swatch: string;
  ring?: string;
}

export const COLOR_OPTIONS: ColorOption[] = [
  { key: 'black',  label: 'Black',  swatch: '#000000' },
  { key: 'white',  label: 'White',  swatch: '#FFFFFF', ring: 'var(--border)' },
  { key: 'gray',   label: 'Gray',   swatch: '#808080' },
  { key: 'red',    label: 'Red',    swatch: '#DC2626' },
  { key: 'orange', label: 'Orange', swatch: '#F97316' },
  { key: 'yellow', label: 'Yellow', swatch: '#EAB308' },
  { key: 'green',  label: 'Green',  swatch: '#16A34A' },
  { key: 'blue',   label: 'Blue',   swatch: '#2563EB' },
  { key: 'purple', label: 'Purple', swatch: '#9333EA' },
  { key: 'pink',   label: 'Pink',   swatch: '#EC4899' },
  { key: 'brown',  label: 'Brown',  swatch: '#7C2D12' },
  { key: 'beige',  label: 'Beige',  swatch: '#D4B896' },
  { key: 'gold',   label: 'Gold',   swatch: '#D4AF37' },
  { key: 'silver', label: 'Silver', swatch: '#C0C0C0', ring: 'var(--border)' },
];

export const CATEGORY_OPTIONS = [
  { key: 'tops',        label: 'Tops' },
  { key: 'bottoms',     label: 'Bottoms' },
  { key: 'outerwear',   label: 'Outerwear' },
  { key: 'footwear',    label: 'Footwear' },
  { key: 'accessories', label: 'Accessories' },
];

export const CLOTHING_SIZE_OPTIONS = [
  { key: 'xs',  label: 'XS',  queryTerm: 'XS' },
  { key: 's',   label: 'S',   queryTerm: 'size S' },
  { key: 'm',   label: 'M',   queryTerm: 'size M' },
  { key: 'l',   label: 'L',   queryTerm: 'size L' },
  { key: 'xl',  label: 'XL',  queryTerm: 'XL' },
  { key: 'xxl', label: 'XXL', queryTerm: 'XXL' },
];

// Combined men's / women's sneaker sizes. Women's = Men's + 1.5 (Nike convention).
// Label shows both so a single chip serves both shopper types; queryTerm uses
// the men's number since that's how listings are predominantly indexed.
export const SHOE_SIZE_OPTIONS = [
  { key: 'm6',    label: 'M 6 / W 7.5',    queryTerm: 'size 6' },
  { key: 'm6_5',  label: 'M 6.5 / W 8',    queryTerm: 'size 6.5' },
  { key: 'm7',    label: 'M 7 / W 8.5',    queryTerm: 'size 7' },
  { key: 'm7_5',  label: 'M 7.5 / W 9',    queryTerm: 'size 7.5' },
  { key: 'm8',    label: 'M 8 / W 9.5',    queryTerm: 'size 8' },
  { key: 'm8_5',  label: 'M 8.5 / W 10',   queryTerm: 'size 8.5' },
  { key: 'm9',    label: 'M 9 / W 10.5',   queryTerm: 'size 9' },
  { key: 'm9_5',  label: 'M 9.5 / W 11',   queryTerm: 'size 9.5' },
  { key: 'm10',   label: 'M 10 / W 11.5',  queryTerm: 'size 10' },
  { key: 'm10_5', label: 'M 10.5 / W 12',  queryTerm: 'size 10.5' },
  { key: 'm11',   label: 'M 11 / W 12.5',  queryTerm: 'size 11' },
  { key: 'm11_5', label: 'M 11.5 / W 13',  queryTerm: 'size 11.5' },
  { key: 'm12',   label: 'M 12 / W 13.5',  queryTerm: 'size 12' },
  { key: 'm13',   label: 'M 13',           queryTerm: 'size 13' },
  { key: 'm14',   label: 'M 14',           queryTerm: 'size 14' },
];

export const SIZE_OPTIONS = [...CLOTHING_SIZE_OPTIONS, ...SHOE_SIZE_OPTIONS];

export interface FilterState {
  color: string | null;
  category: string | null;
  size: string | null;
  minPrice: number | null;
  maxPrice: number | null;
}

export function emptyFilterState(): FilterState {
  return { color: null, category: null, size: null, minPrice: null, maxPrice: null };
}

export function filtersToQuerySuffix(filters: FilterState): string {
  const parts: string[] = [];
  if (filters.color) parts.push(filters.color);
  if (filters.category) parts.push(filters.category);
  if (filters.size) {
    const s = SIZE_OPTIONS.find((o) => o.key === filters.size);
    if (s) parts.push(s.queryTerm);
  }
  return parts.join(' ');
}
