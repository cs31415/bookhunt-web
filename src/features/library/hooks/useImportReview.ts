import { useState } from 'react';
import { addToLibrary } from '../../../api/library/add-to-library';
import type { AddToLibraryRawFields } from '../../../api/library/add-to-library';
import { mapWithConcurrency } from '../../../shared/lib/map-with-concurrency';
import { toast } from '../../../shared/toast/toast-store';
import type { LibraryStatus } from '../../../shared/types/library-status';

/** AC4: the cycle button walks these three; 'abandoned' isn't offered at import time. */
export const IMPORT_STATUS_CYCLE: LibraryStatus[] = ['queued', 'reading', 'finished'];

/**
 * Library writes in flight at once. A photo yields ~20 books, but a CSV can
 * yield hundreds — unbounded, that opens hundreds of simultaneous connections
 * and stalls the browser's request queue.
 */
const ADD_CONCURRENCY = 6;

export interface AddArgs {
  slug: string;
  rawFields?: AddToLibraryRawFields;
}

export interface UseImportReviewOptions<TRow> {
  rows: TRow[];
  /** Stable identity per row. Must be unique even for identical content. */
  keyOf: (row: TRow) => string;
  /** How to add one row, given the status the reader chose for it. */
  toAddArgs: (row: TRow) => AddArgs | null;
  /** Rows that start unticked — e.g. ones nothing could be matched to. */
  startsUnticked?: (row: TRow) => boolean;
  onAdded?: (count: number) => void;
}

export interface UseImportReviewResult<TRow> {
  statusFor: (key: string) => LibraryStatus;
  isTicked: (key: string) => boolean;
  selectedCount: number;
  cycleStatus: (key: string) => void;
  toggle: (key: string) => void;
  adding: boolean;
  /** Set when some rows failed; the caller should keep the modal open to show it. */
  addError: string | null;
  /** Resolves true when everything selected was added. */
  confirm: () => Promise<boolean>;
  /** Applies each row's default tick state; safe to call repeatedly as rows change. */
  registerRows: (rows: TRow[]) => void;
  /** Wipes every default and choice, for starting an import over. */
  clearSelection: () => void;
}

/**
 * The review-and-commit half of an import, shared by photo scan and CSV import.
 * Knows nothing about where the rows came from — the caller supplies identity
 * and how to turn a row into a library write.
 */
export function useImportReview<TRow>(
  options: UseImportReviewOptions<TRow>,
): UseImportReviewResult<TRow> {
  const { rows, keyOf, toAddArgs, startsUnticked, onAdded } = options;

  const [statusByKey, setStatusByKey] = useState<Record<string, LibraryStatus>>({});
  // Split into "what this row defaults to" and "what the reader chose", so rows
  // arriving mid-review get their default without disturbing existing choices.
  // A single Set rebuilt per batch would wipe them.
  const [defaultUnticked, setDefaultUnticked] = useState<Set<string>>(new Set());
  const [tickOverrides, setTickOverrides] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  function statusFor(key: string): LibraryStatus {
    return statusByKey[key] ?? 'queued';
  }

  function isTicked(key: string): boolean {
    return tickOverrides[key] ?? !defaultUnticked.has(key);
  }

  function cycleStatus(key: string) {
    setStatusByKey((current) => {
      const index = IMPORT_STATUS_CYCLE.indexOf(current[key] ?? 'queued');
      return { ...current, [key]: IMPORT_STATUS_CYCLE[(index + 1) % IMPORT_STATUS_CYCLE.length] };
    });
  }

  // Tick state is tracked separately from status so unticking and re-ticking
  // doesn't silently reset a status the reader already chose.
  function toggle(key: string) {
    const next = !isTicked(key);
    setTickOverrides((current) => ({ ...current, [key]: next }));
  }

  /**
   * Recomputes defaults for the rows given, leaving the reader's own choices
   * alone. Idempotent, so a row can be registered again once it changes — a CSV
   * row starts unticked while it's still being looked up, then ticks itself when
   * a match arrives, unless the reader has since said otherwise.
   */
  function registerRows(newRows: TRow[]) {
    if (!startsUnticked) return;
    setDefaultUnticked((current) => {
      const next = new Set(current);
      for (const row of newRows) {
        if (startsUnticked(row)) next.add(keyOf(row));
        else next.delete(keyOf(row));
      }
      return next;
    });
  }

  /** Wipes every default and choice — for starting an import over. */
  function clearSelection() {
    setStatusByKey({});
    setDefaultUnticked(new Set());
    setTickOverrides({});
    setAddError(null);
  }

  const selected = rows.filter((row) => isTicked(keyOf(row)));

  async function confirm(): Promise<boolean> {
    if (selected.length === 0) return true;
    setAdding(true);
    setAddError(null);
    try {
      // mapWithConcurrency rejects on first failure, so each add is wrapped to
      // keep allSettled semantics: one book that won't upsert must not discard
      // the rest of a 200-row import.
      const outcomes = await mapWithConcurrency(selected, ADD_CONCURRENCY, async (row) => {
        const args = toAddArgs(row);
        if (!args) return false;
        try {
          await addToLibrary(args.slug, statusFor(keyOf(row)), args.rawFields);
          return true;
        } catch {
          return false;
        }
      });

      const added = outcomes.filter(Boolean).length;
      if (added > 0) onAdded?.(added);
      if (added < selected.length) {
        setAddError(
          added === 0
            ? "Couldn't add those books — please try again."
            : `Added ${added} of ${selected.length}. The rest couldn't be added — you can retry them.`,
        );
        toast({
          text: `Imported ${added} of ${selected.length} books. ${selected.length - added} books had errors.`,
        });
        return false;
      }
      toast({ text: `Successfully imported ${added} ${added === 1 ? 'book' : 'books'}.` });
      return true;
    } finally {
      setAdding(false);
    }
  }

  return {
    statusFor,
    isTicked,
    selectedCount: selected.length,
    cycleStatus,
    toggle,
    adding,
    addError,
    confirm,
    registerRows,
    clearSelection,
  };
}
