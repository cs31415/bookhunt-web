export type LibraryStatus = 'queued' | 'reading' | 'finished' | 'abandoned';

export const ALL_LIBRARY_STATUSES: LibraryStatus[] = ['queued', 'reading', 'finished', 'abandoned'];

export const LIBRARY_STATUS_LABELS: Record<LibraryStatus, string> = {
  queued: 'Queued',
  reading: 'Reading',
  finished: 'Finished',
  abandoned: 'Abandoned',
};

// Shared across the Library page charts and Discover's snapshot pie so a status
// keeps the same colour everywhere.
export const LIBRARY_STATUS_COLORS: Record<LibraryStatus, string> = {
  queued: 'var(--slate)',
  reading: 'var(--rust)',
  finished: 'var(--sage)',
  abandoned: 'var(--muted)',
};
