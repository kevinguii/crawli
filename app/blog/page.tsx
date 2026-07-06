import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
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
  return new Date(iso.includes('T') ? iso : iso + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function BlogIndex() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const isAuthenticated = !error && !!data.user;

  const posts = getAllPosts();

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <LandingNav isAuthenticated={isAuthenticated} />

      <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-14 sm:px-8">
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
          <ul className="flex flex-col gap-6">
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
                  <div className="grid grid-cols-1 sm:grid-cols-[320px_1fr]">
                    {/* Image column */}
                    <div
                      className="flex items-center justify-center"
                      style={{ background: '#ffffff', minHeight: '200px' }}
                    >
                      {post.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.cover}
                          alt={post.title}
                          className="h-full w-full object-contain p-6"
                          style={{ maxHeight: '200px' }}
                          loading="lazy"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src="/icon.svg" alt={post.title} className="h-12 w-12 opacity-20" />
                      )}
                    </div>

                    {/* Content column */}
                    <div className="flex flex-col justify-between gap-4 p-6 sm:p-8">
                      <div className="flex flex-col gap-3">
                        <h2
                          className="leading-snug tracking-tight"
                          style={{ color: 'var(--text)', fontSize: '1.4rem', fontWeight: 600 }}
                        >
                          {post.title}
                        </h2>
                        {post.description && (
                          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', lineHeight: '1.6' }}>
                            {post.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/icon.svg"
                          alt="Crawli"
                          className="h-7 w-7 rounded-full"
                          style={{ background: 'var(--border)', padding: '3px' }}
                        />
                        <div className="flex flex-col leading-none">
                          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                            Kevin Gui
                          </span>
                          <span className="mt-1 text-xs" style={{ color: 'var(--text-dim)' }}>
                            {formatDate(post.date)}
                          </span>
                        </div>
                      </div>
                    </div>
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
