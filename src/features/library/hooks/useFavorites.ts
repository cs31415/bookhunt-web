import { useCallback, useMemo, useState } from 'react';
import { setFavorite } from '../../../api/library/set-favorite';
import { toast } from '../../../shared/toast/toast-store';
import type { LibraryEntry } from '../../../normalize/library';

/**
 * Favourite toggling for the library grid, applied optimistically.
 *
 * useLibraryData walks every page of /library up front, so refetching to see
 * one boolean change would re-read the whole collection. Instead the new value
 * is held here as an override and merged over the fetched entries.
 *
 * A failed request drops the override rather than writing the old value back:
 * falling through to whatever the server last said is right even if two
 * toggles raced, where remembering "it was false" would not be.
 */
export function useFavorites() {
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});

  const apply = useCallback(
    (entries: LibraryEntry[]): LibraryEntry[] => {
      if (Object.keys(overrides).length === 0) return entries;
      return entries.map((entry) =>
        entry.book.id in overrides
          ? { ...entry, isFavorite: overrides[entry.book.id] }
          : entry,
      );
    },
    [overrides],
  );

  const toggle = useCallback(async (entry: LibraryEntry, next: boolean) => {
    const bookId = entry.book.id;
    setOverrides((current) => ({ ...current, [bookId]: next }));

    try {
      await setFavorite(bookId, next);
    } catch {
      setOverrides((current) => {
        const rest = { ...current };
        delete rest[bookId];
        return rest;
      });
      toast({
        text: next
          ? `Could not favourite “${entry.book.title}”`
          : `Could not remove “${entry.book.title}” from favourites`,
      });
    }
  }, []);

  return useMemo(() => ({ apply, toggle }), [apply, toggle]);
}
