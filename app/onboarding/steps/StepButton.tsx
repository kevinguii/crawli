'use client';

interface StepButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  className?: string;
}

export default function StepButton({
  onClick,
  disabled,
  children,
  variant = 'primary',
  className = 'mt-6',
}: StepButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`${className} w-full rounded-xl px-4 py-3 text-sm font-medium disabled:opacity-50`}
      style={
        variant === 'primary'
          ? { background: 'var(--accent)', color: '#fff' }
          : { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)' }
      }
    >
      {children}
    </button>
  );
}
