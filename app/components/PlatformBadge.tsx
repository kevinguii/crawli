import { PLATFORM_NAMES } from '@/lib/types';
import { platformStyle } from './platformColors';

interface Props {
  platform: string;
  className?: string;
}

// Renders a small pill badge for a platform.
// eBay gets a 4-stripe vertical gradient (red/blue/yellow/green).
// All others get a solid background. Text is white except Vestiaire (black).
export default function PlatformBadge({ platform, className = '' }: Props) {
  const { background, color } = platformStyle(platform);
  const label = PLATFORM_NAMES[platform] ?? platform;

  if (platform === 'ebay') {
    return (
      <span
        className={`inline-block rounded-full overflow-hidden text-[10px] font-semibold uppercase tracking-wide ${className}`}
        style={{ background, color: 'transparent', lineHeight: '1.5', padding: 0 }}
      >
        <span
          className="block px-2 py-0.5"
          style={{ color, mixBlendMode: 'normal' }}
        >
          {label}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}
      style={{ background, color, lineHeight: '1.5' }}
    >
      {label}
    </span>
  );
}
