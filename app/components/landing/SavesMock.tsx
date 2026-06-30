import PlatformBadge from '@/app/components/PlatformBadge';
import MockFrame from './MockFrame';

type Saved = {
  platform: string;
  title: string;
  price: string;
};

const SAVED: Saved[] = [
  { platform: 'grailed', title: 'Rick Owens DRKSHDW Geobasket', price: '$320' },
  { platform: 'depop', title: 'Carhartt Detroit Jacket — Hamilton Brown', price: '$140' },
  { platform: 'vestiaire', title: 'Margiela 5AC Mini Bag', price: '$680' },
  { platform: 'stockx', title: 'Air Jordan 1 Mocha — 10', price: '$295' },
];

const FOLDERS = ['All', 'Outerwear', 'Footwear', 'Bags'];

export default function SavesMock() {
  return (
    <section className="py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--accent-text)' }}
          >
            Build your wishlist
          </p>
          <h2
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: 'var(--text)' }}
          >
            Heart what you love. Organize what you keep.
          </h2>
          <p
            className="mt-3 text-base"
            style={{ color: 'var(--text-muted)' }}
          >
            Save any listing across any platform. Sort into folders. Track
            price drops on the ones you’re still thinking about.
          </p>
        </div>

        <div className="mt-12">
          <MockFrame url="thecrawli.com/saves">
            {/* Folder tabs */}
            <div
              className="flex items-center gap-1 overflow-x-auto px-5 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              {FOLDERS.map((f, i) => (
                <span
                  key={f}
                  className="rounded-md px-3 py-1.5 text-xs font-medium"
                  style={
                    i === 0
                      ? { background: 'var(--accent)', color: '#fff' }
                      : { color: 'var(--text-muted)' }
                  }
                >
                  {f}
                </span>
              ))}
              <span
                className="ml-auto hidden text-xs sm:inline-block"
                style={{ color: 'var(--text-dim)' }}
              >
                {SAVED.length} saved
              </span>
            </div>

            {/* Grid */}
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {SAVED.map((s, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    className="relative h-32 w-full"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--surface-hover), var(--track))',
                    }}
                  >
                    <div className="absolute left-2 top-2">
                      <PlatformBadge platform={s.platform} />
                    </div>
                    <div
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full"
                      style={{ background: 'var(--bg-elevated)' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#E24B4A" stroke="#E24B4A" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </div>
                  </div>
                  <div className="p-3">
                    <p
                      className="line-clamp-2 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {s.title}
                    </p>
                    <p
                      className="mt-2 text-lg font-bold"
                      style={{ color: 'var(--text)' }}
                    >
                      {s.price}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </MockFrame>
        </div>
      </div>
    </section>
  );
}
