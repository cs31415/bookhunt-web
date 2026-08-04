export type LibraryStatus = 'queued' | 'reading' | 'finished' | 'abandoned';

export const ALL_LIBRARY_STATUSES: LibraryStatus[] = ['queued', 'reading', 'finished', 'abandoned'];

export const LIBRARY_STATUS_LABELS: Record<LibraryStatus, string> = {
  queued: 'New',
  reading: 'Reading',
  finished: 'Finished',
  abandoned: 'Abandoned',
};

/**
 * One mark per status, legible at 13px over artwork. Deliberately not emoji:
 * these render in the reader's text colour, and emoji would bring their own.
 * Shared by the cover fold and the status menu, so the fold's mark is learnable
 * from the menu it is set in.
 */
export const LIBRARY_STATUS_GLYPHS: Record<LibraryStatus, string> = {
  queued: '★',
  reading: '◐',
  finished: '✓',
  abandoned: '–',
};

// Shared across the Library page charts and Discover's snapshot pie so a status
// keeps the same colour everywhere.
export const LIBRARY_STATUS_COLORS: Record<LibraryStatus, string> = {
  queued: 'var(--slate)',
  reading: 'var(--rust)',
  finished: 'var(--sage)',
  abandoned: 'var(--muted)',
};
