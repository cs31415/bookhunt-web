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

/**
 * Draw-again glyph for the Discover pills: one open circular stroke with the
 * gap and the arrowhead at the top right. Deliberately a single arc rather than
 * the usual pair of chasing arrows — at 15px two arrows read as noise, and this
 * sits next to DiscoverIcon, which is also a circle at this weight.
 */
export function RefreshIcon({ className }: IconProps) {
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
      <path d="M17.7 6.3A8 8 0 1 1 12 4" />
      <path d="M10.2 2.4L12 4l-1.8 1.6" />
    </svg>
  );
}

/**
 * Bare chevron for stepping through the draw history beside the refresh glyph.
 *
 * One component with a direction rather than a mirrored pair, and separate from
 * BackArrowIcon, which is heavier and belongs to page navigation — these two
 * sit at 13px next to RefreshIcon and have to match its weight, not the nav's.
 */
export function ChevronIcon({ className, direction }: IconProps & { direction: 'left' | 'right' }) {
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
      <path d={direction === 'left' ? 'M14.5 18l-6-6 6-6' : 'M9.5 6l6 6-6 6'} />
    </svg>
  );
}

/**
 * Thumbtack, seen head on. Lighter stroke than the nav icons because it renders
 * at roughly half their size, on the corner of a pill, where 1.9 goes muddy.
 */
export function PinIcon({ className, filled }: IconProps & { filled?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.5 3h5l-.9 5.7 2.9 2.7v1.6H7.5v-1.6l2.9-2.7z" />
      <path d="M12 13v6" />
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
