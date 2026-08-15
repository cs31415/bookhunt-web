import { useCallback, useMemo, useState } from 'react';
import { setFavorite } from '../../../api/library/set-favorite';
import { setHidden } from '../../../api/library/set-hidden';
import { toast } from '../../../shared/toast/toast-store';
import type { LibraryEntry } from '../../../normalize/library';

type Flag = 'isFavorite' | 'isHidden';

/** One override per book per flag, so favouriting and hiding cannot clobber each other. */
type Overrides = Record<number, Partial<Record<Flag, boolean>>>;

/**
 * Optimistic toggling for both per-book flags on the library grid.
 *
 * useLibraryData walks every page of /library up front, so refetching to see
 * one boolean change would re-read the whole collection. The new value is held
 * here as an override and merged over the fetched entries instead.
 *
 * A failed request drops the override rather than writing the old value back:
 * falling through to whatever the server last said is right even if two toggles
 * raced, where remembering "it was false" would not be.
 *
 * Was useFavorites (LOS-252). Generalised rather than copied when hiding
 * arrived, because the two differ only in which endpoint they call.
 */
export function useEntryFlags() {
  const [overrides, setOverrides] = useState<Overrides>({});

  const apply = useCallback(
    (entries: LibraryEntry[]): LibraryEntry[] => {
      if (Object.keys(overrides).length === 0) return entries;
      return entries.map((entry) =>
        entry.book.id in overrides ? { ...entry, ...overrides[entry.book.id] } : entry,
      );
    },
    [overrides],
  );

  const set = useCallback((bookId: number, flag: Flag, value: boolean | undefined) => {
    setOverrides((current) => {
      const forBook = { ...current[bookId] };
      if (value === undefined) delete forBook[flag];
      else forBook[flag] = value;

      const next = { ...current };
      if (Object.keys(forBook).length === 0) delete next[bookId];
      else next[bookId] = forBook;
      return next;
    });
  }, []);

  const toggleFavorite = useCallback(
    async (entry: LibraryEntry, next: boolean) => {
      set(entry.book.id, 'isFavorite', next);
      try {
        await setFavorite(entry.book.id, next);
      } catch {
        set(entry.book.id, 'isFavorite', undefined);
        toast({
          text: next
            ? `Could not favourite “${entry.book.title}”`
            : `Could not remove “${entry.book.title}” from favourites`,
        });
      }
    },
    [set],
  );

  const toggleHidden = useCallback(
    async (entry: LibraryEntry, next: boolean) => {
      set(entry.book.id, 'isHidden', next);
      try {
        await setHidden(entry.book.id, next);
      } catch {
        set(entry.book.id, 'isHidden', undefined);
        toast({
          text: next
            ? `Could not hide “${entry.book.title}”`
            : `Could not show “${entry.book.title}” again`,
        });
      }
    },
    [set],
  );

  /**
   * Hides several at once. Sequential rather than parallel: the selection can
   * be the whole shelf, and a few hundred simultaneous requests is how a
   * rate limit gets hit. Failures are counted and reported once, because a
   * toast per book would bury the page.
   */
  const hideMany = useCallback(
    async (entries: LibraryEntry[], next: boolean) => {
      for (const entry of entries) set(entry.book.id, 'isHidden', next);

      const failed: LibraryEntry[] = [];
      for (const entry of entries) {
        try {
          await setHidden(entry.book.id, next);
        } catch {
          failed.push(entry);
          set(entry.book.id, 'isHidden', undefined);
        }
      }

      if (failed.length > 0) {
        toast({
          text: `Could not ${next ? 'hide' : 'show'} ${failed.length} of ${entries.length} books`,
        });
      }
    },
    [set],
  );

  return useMemo(
    () => ({ apply, toggleFavorite, toggleHidden, hideMany }),
    [apply, toggleFavorite, toggleHidden, hideMany],
  );
}
