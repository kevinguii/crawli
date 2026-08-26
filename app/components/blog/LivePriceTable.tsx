import Link from 'next/link';
import { hoursAgo, type CompareSnapshot } from '@/lib/compare';
import { PLATFORM_NAMES } from '@/lib/types';

interface LivePriceTableProps {
  compareSlug: string;
  itemName: string;
  snapshots: CompareSnapshot[];
}

function fmt(price: number | null): string {
  if (price === null) return '-';
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function LivePriceTable({ compareSlug, itemName, snapshots }: LivePriceTableProps) {
  const withPrice = snapshots.filter((s) => s.min_price_usd !== null);

  if (withPrice.length === 0) {
    return (
      <div className="blog-content">
        <p>
          Live pricing temporarily unavailable. See the{' '}
          <Link href={`/compare/${compareSlug}`}>comparison page</Link> for {itemName}.
        </p>
      </div>
    );
  }

  const sorted = [...withPrice].sort(
    (a, b) => (a.min_price_usd ?? Infinity) - (b.min_price_usd ?? Infinity),
  );

  const latestScrape = sorted.reduce<string>(
    (latest, s) => (s.scraped_at > latest ? s.scraped_at : latest),
    sorted[0].scraped_at,
  );

  return (
    <div className="blog-content">
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Lowest listing</th>
              <th>Typical (avg)</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.platform}>
                <td>{PLATFORM_NAMES[s.platform] ?? s.platform}</td>
                <td>{fmt(s.min_price_usd)}</td>
                <td>{fmt(s.avg_price_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '0.85rem' }}>
        Updated {hoursAgo(latestScrape)}.{' '}
        <Link href={`/compare/${compareSlug}`}>See the live, constantly updated comparison</Link>.
      </p>
    </div>
  );
}
