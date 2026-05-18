interface Props {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

function formatJoined(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function ProfileHeader({ email, displayName, avatarUrl, createdAt }: Props) {
  const name = displayName?.trim() || email.split('@')[0];
  const initial = (name || '?').charAt(0).toUpperCase();

  return (
    <section
      className="flex flex-col items-start gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:gap-6"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          className="h-16 w-16 rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-semibold"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {initial}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h1
          className="truncate text-2xl font-semibold tracking-tight"
          style={{ color: 'var(--text)' }}
        >
          {name}
        </h1>
        <p className="truncate text-sm" style={{ color: 'var(--text-muted)' }}>
          {email}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-dim)' }}>
          Joined {formatJoined(createdAt)}
        </p>
      </div>
    </section>
  );
}
