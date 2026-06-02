import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LandingNav from '@/app/components/landing/LandingNav';
import Footer from '@/app/components/landing/Footer';
import { getAllSlugs, getPost } from '@/lib/blog';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://thecrawli.com';

interface Props {
  params: Promise<{ slug: string }>;
}

// Pre-render every post at build time — these are fully static pages.
export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};

  const url = `${SITE_URL}/blog/${slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: 'article',
      url,
      title: post.title,
      description: post.description,
      publishedTime: post.date || undefined,
      images: post.cover ? [{ url: post.cover }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: post.cover ? [post.cover] : undefined,
    },
  };
}

function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  // Article structured data so the post is eligible for rich results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date || undefined,
    image: post.cover ? `${SITE_URL}${post.cover}` : undefined,
    url: `${SITE_URL}/blog/${slug}`,
    author: { '@type': 'Organization', name: 'Crawli' },
    publisher: {
      '@type': 'Organization',
      name: 'Crawli',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${slug}` },
  };

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingNav />

      <article className="mx-auto w-full max-w-2xl flex-1 px-5 py-14 sm:px-8">
        <Link
          href="/blog"
          className="text-sm transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          ← All posts
        </Link>

        <header className="mt-6 mb-8">
          <p
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: 'var(--text-dim)' }}
          >
            {formatDate(post.date)}
          </p>
          <h1
            className="mt-2 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
            style={{ color: 'var(--text)' }}
          >
            {post.title}
          </h1>
        </header>

        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
      </article>

      <Footer />
    </main>
  );
}
