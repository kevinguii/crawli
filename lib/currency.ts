// Approximate exchange rates to USD — used only for display normalization.
// Users see the original currency when they open the listing.
const RATES_TO_USD: Record<string, number> = {
  USD: 1,
  GBP: 1.34,      // was 1.27 ❌
  EUR: 1.17,      // was 1.08 ❌
  AUD: 0.73,      // was 0.65 ❌
  CAD: 0.73,      // was 0.73 ✓
  JPY: 0.0063,    // was 0.0067 ❌
  NZD: 0.61,      // was 0.61 ✓ (based on EUR data)
  CHF: 1.11,      // was 1.13 ❌
  SEK: 0.093,     // was 0.096 ❌
  DKK: 0.134,     // was 0.145 ❌
  NOK: 0.108,     // was 0.093 ❌
};

export function convertToUSD(price: number, currency: string): number | null {
  const rate = RATES_TO_USD[currency.toUpperCase()];
  if (rate == null) return null;
  return Math.round(price * rate * 100) / 100;
}
