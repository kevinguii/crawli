import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LandingNav from '@/app/components/landing/LandingNav';
import Footer from '@/app/components/landing/Footer';
import CollapsibleFAQ from '@/app/components/blog/CollapsibleFAQ';
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
  return new Date(iso.includes('T') ? iso : iso + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const isAuthenticated = !error && !!data.user;

  // Structured data: BlogPosting always, plus FAQPage when the post defines an
  // FAQ. Both go in one @graph so a single script tag covers the page. AI answer
  // engines (ChatGPT, Perplexity, Google AI Overviews) read this from the HTML
  // without running JS, and favour recently-updated, FAQ-backed pages.
  const blogPosting = {
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date || undefined,
    dateModified: post.updated || post.date || undefined,
    image: post.cover ? `${SITE_URL}${post.cover}` : undefined,
    url: `${SITE_URL}/blog/${slug}`,
    author: { '@type': 'Person', name: 'Kevin Gui' },
    publisher: {
      '@type': 'Organization',
      name: 'Crawli',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/blog/${slug}` },
  };

  // FAQPage must mirror the visible on-page FAQ exactly (Google requirement).
  const faqPage =
    post.faq.length > 0
      ? {
          '@type': 'FAQPage',
          mainEntity: post.faq.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        }
      : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': faqPage ? [blogPosting, faqPage] : [blogPosting],
  };

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingNav isAuthenticated={isAuthenticated} />

      <article className="mx-auto w-full max-w-2xl flex-1 px-5 py-14 sm:px-8">
        <Link
          href="/blog"
          className="text-sm transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          ← All posts
        </Link>

        {/* Title */}
        <header className="mt-6 mb-8">
          <h1
            className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
            style={{ color: 'var(--text)' }}
          >
            {post.title}
          </h1>

          {/* Author / date */}
          <div className="mt-5 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt="Kevin Gui"
              className="h-8 w-8 rounded-full"
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
        </header>

        {/* Cover image */}
        {post.cover && (
          <div
            className="mb-10 flex items-center justify-center overflow-hidden rounded-xl"
            style={{ background: '#ffffff', minHeight: '260px' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.cover}
              alt={post.title}
              className="object-contain p-8"
              style={{ maxHeight: '380px', maxWidth: '100%' }}
            />
          </div>
        )}

        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />

        {/* On-page FAQ — collapsible accordion. Mirrors the FAQPage JSON-LD above.
            Drives Google's People Also Ask and gives AI answer engines clean Q&A. */}
        {post.faq.length > 0 && <CollapsibleFAQ items={post.faq} />}
      </article>

      <Footer />
    </main>
  );
}
