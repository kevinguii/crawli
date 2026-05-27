export default function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span
      style={{
        fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
        fontSize: `${size}px`,
        fontWeight: 700,
        letterSpacing: '-0.5px',
        background:
          'linear-gradient(to right, #E24B4A, #E84D1D, #D85A30, #EF9F27, #FAC775)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        lineHeight: 1.2,
      }}
    >
      Crawli
    </span>
  );
}
