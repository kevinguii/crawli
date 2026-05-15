import type { Metadata } from 'next';
import SearchSection from './components/SearchSection';

export const metadata: Metadata = {
  title: 'Fashion Resale Search',
  description: 'Search prices across Grailed, Depop, StockX, Vestiaire, Vinted, and Mercari.',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Fashion Resale Search
          </h1>
          <p className="mt-2 text-gray-500">
            Search across Grailed, Depop, StockX, Vestiaire, Vinted &amp; Mercari at once.
          </p>
        </div>

        <SearchSection />
      </div>
    </main>
  );
}
