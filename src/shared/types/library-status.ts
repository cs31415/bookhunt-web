export type LibraryStatus = 'queued' | 'reading' | 'finished' | 'abandoned';

export const ALL_LIBRARY_STATUSES: LibraryStatus[] = ['queued', 'reading', 'finished', 'abandoned'];

export const LIBRARY_STATUS_LABELS: Record<LibraryStatus, string> = {
  queued: 'Queued',
  reading: 'Reading',
  finished: 'Finished',
  abandoned: 'Abandoned',
};
