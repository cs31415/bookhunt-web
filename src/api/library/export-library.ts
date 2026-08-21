import { apiFetch } from '../client';

export interface ExportedBook {
  title: string;
  author: string;
  publisher: string | null;
  isbn: string | null;
  /**
   * The stored word — queued, reading, finished, abandoned — not the label the
   * import modal shows. A machine-readable file carries the machine-readable
   * word (LOS-302).
   */
  status: string;
}

export interface LibraryExport {
  exportedAt: string;
  books: ExportedBook[];
  favorites: {
    books: ExportedBook[];
    authors: { name: string; slug: string }[];
    users: { handle: string; displayName: string }[];
  };
}

// GET /library/export (LOS-302) answers with the whole library in one response,
// so it does not paginate — the API walks it server-side. Rate-limited to 10 an
// hour, which is the one error worth telling a reader apart from a failure.
export function exportLibrary(signal?: AbortSignal): Promise<LibraryExport> {
  return apiFetch('/library/export', { signal });
}
