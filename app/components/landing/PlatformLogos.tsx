import PlatformBadge from '@/app/components/PlatformBadge';

const PLATFORMS = [
  'grailed',
  'depop',
  'poshmark',
  'mercari',
  'vinted',
  'stockx',
  'ebay',
  'vestiaire',
];

export default function PlatformLogos() {
  return (
    <section
      className="border-y py-10"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <p
          className="mb-6 text-center text-xs font-medium uppercase tracking-wider"
          style={{ color: 'var(--text-dim)' }}
        >
          Compare secondhand prices across every resale platform you already use
        </p>

        {/* Desktop: static row */}
        <div className="hidden flex-wrap items-center justify-center gap-3 sm:flex">
          {PLATFORMS.map((p) => (
            <PlatformBadge key={p} platform={p} className="text-xs px-3 py-1" />
          ))}
        </div>

        {/* Mobile: marquee */}
        <div className="relative overflow-hidden sm:hidden">
          <div className="marquee flex w-max items-center gap-3 whitespace-nowrap">
            {[...PLATFORMS, ...PLATFORMS].map((p, i) => (
              <PlatformBadge
                key={`${p}-${i}`}
                platform={p}
                className="text-xs px-3 py-1"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
