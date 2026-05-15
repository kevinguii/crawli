'use client';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

interface Props {
  priceRange: { min: number; max: number } | null;
  averagePrice: number | null;
  totalCount: number;
}

export default function PriceSummary({ priceRange, averagePrice, totalCount }: Props) {
  if (!priceRange || totalCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl bg-gray-50 border border-gray-200 px-5 py-3 text-sm">
      <span className="font-medium text-gray-600">
        {totalCount} listing{totalCount !== 1 ? 's' : ''} found
      </span>
      <div className="flex gap-4">
        <Stat label="Low" value={fmt.format(priceRange.min)} color="text-green-700" />
        <Stat label="High" value={fmt.format(priceRange.max)} color="text-red-600" />
        {averagePrice !== null && (
          <Stat label="Avg" value={fmt.format(averagePrice)} color="text-gray-800" />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span>
      <span className="text-gray-500">{label}: </span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </span>
  );
}
