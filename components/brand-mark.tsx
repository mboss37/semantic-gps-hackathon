type Props = { className?: string };

// Mission-control radar mark: cyan→indigo gradient circle with two concentric
// arcs (top-right gap suggesting a sweep) and a centered dot. Single source
// for landing nav, landing footer, dashboard sidebar, auth layout, and the
// dynamic favicon at app/icon.tsx.

export const BrandMark = ({ className }: Props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden
  >
    <circle cx="12" cy="12" r="11" fill="url(#brand-gradient)" />
    <path
      d="M 12 4.5 A 7.5 7.5 0 1 0 19.5 12"
      stroke="white"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeOpacity="0.4"
    />
    <path
      d="M 12 7.5 A 4.5 4.5 0 1 0 16.5 12"
      stroke="white"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeOpacity="0.7"
    />
    <circle cx="12" cy="12" r="1.75" fill="white" />
    <defs>
      <linearGradient id="brand-gradient" x1="2" y1="2" x2="22" y2="22">
        <stop offset="0" stopColor="#7dd3fc" />
        <stop offset="1" stopColor="#6366f1" />
      </linearGradient>
    </defs>
  </svg>
);
