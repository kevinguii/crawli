import Link from 'next/link';
import type { Metadata } from 'next';
import LandingNav from '@/app/components/landing/LandingNav';
import Footer from '@/app/components/landing/Footer';
import { getAllPosts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Guides and tips for buying secondhand fashion: how to compare resale prices, spot deals, and shop smarter across Grailed, Depop, Poshmark, StockX, eBay and more.',
  alternates: { canonical: '/blog' },
};

function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <LandingNav />

      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-14 sm:px-8">
        <header className="mb-10">
          <h1
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: 'var(--text)' }}
          >
            The Crawli Blog
          </h1>
          <p className="mt-3 text-base" style={{ color: 'var(--text-muted)' }}>
            Guides and tips for buying secondhand fashion the smart way.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>
            No posts yet — check back soon.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="bento-card block overflow-hidden rounded-xl"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {post.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.cover}
                      alt=""
                      className="h-44 w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="p-5">
                    <p
                      className="text-xs font-medium uppercase tracking-wide"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      {formatDate(post.date)}
                    </p>
                    <h2
                      className="mt-1.5 text-lg font-semibold tracking-tight"
                      style={{ color: 'var(--text)' }}
                    >
                      {post.title}
                    </h2>
                    {post.description && (
                      <p
                        className="mt-2 text-sm leading-relaxed"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {post.description}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Footer />
    </main>
  );
}
