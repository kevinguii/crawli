import Link from 'next/link';

export default function CTASection() {
  return (
    <section className="px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h2
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ color: 'var(--text)' }}
        >
          Start finding better prices today.
        </h2>
        <p
          className="mx-auto mt-3 text-sm sm:text-base"
          style={{ color: 'var(--text-muted)' }}
        >
          Free forever. No credit card required.
        </p>
        <Link
          href="/login?tab=signup"
          className="btn-primary mt-6 inline-block rounded-xl px-7 py-3 text-sm font-semibold"
        >
          Create free account
        </Link>
      </div>
    </section>
  );
}
