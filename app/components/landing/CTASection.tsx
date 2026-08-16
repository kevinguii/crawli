import CtaLink from './CtaLink';

export default function CTASection() {
  return (
    <section className="px-5 pb-16 pt-4 sm:px-8 sm:pb-20 sm:pt-6">
      <div className="mx-auto max-w-3xl text-center">
        <h2
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ color: 'var(--text)' }}
        >
          Start comparing smarter today.
        </h2>
        <p
          className="mx-auto mt-3 text-sm sm:text-base"
          style={{ color: 'var(--text-muted)' }}
        >
          Free to start. No credit card required.
        </p>
        <CtaLink
          location="cta_section"
          className="btn-primary mt-6 inline-block rounded-xl px-7 py-3 text-sm font-semibold"
        >
          Sign up
        </CtaLink>
      </div>
    </section>
  );
}
