export interface IconProps {
  className?: string;
}

export function LogoMark({ className, light }: IconProps & { light?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="26" height="24" rx="2.5" fill={light ? '#fff' : 'var(--rust)'} />
      <path d="M16 6.5v19" stroke={light ? 'var(--rust)' : 'var(--card)'} strokeWidth="1.6" />
      <path
        d="M7.5 10.5h5M7.5 14h5M19.5 10.5h5M19.5 14h5"
        stroke={light ? 'var(--rust)' : 'var(--card)'}
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}

export function DiscoverIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M14.8 9.2l-1.6 4.4-4.4 1.6 1.6-4.4z" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function LibraryIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5h4v14H4zM10 5h4v14h-4z" />
      <path d="M16.5 5.4l3.5.9-3.3 12.8-3.5-.9" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8.5" r="3.2" />
      <path d="M5 20c1.2-3.8 4.2-6 7-6s5.8 2.2 7 6" />
    </svg>
  );
}

export function BackArrowIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
