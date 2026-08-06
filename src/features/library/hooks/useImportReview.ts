import { useState } from 'react';
import { addToLibrary } from '../../../api/library/add-to-library';
import type { AddToLibraryRawFields } from '../../../api/library/add-to-library';
import { categorizeBooks } from '../../../api/ai/categorize';
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
  /**
   * The status a row starts on, when its source knows one — a CSV may carry a
   * status column. Null, or omitted entirely, leaves the row on 'queued'.
   */
  defaultStatusOf?: (row: TRow) => LibraryStatus | null;
  onAdded?: (count: number) => void;
}

export interface UseImportReviewResult<TRow> {
  statusFor: (key: string) => LibraryStatus;
  isTicked: (key: string) => boolean;
  selectedCount: number;
  cycleStatus: (key: string) => void;
  toggle: (key: string) => void;
  adding: boolean;
  /**
   * Rows written so far and the total being written, so a long add can say more
   * than "Adding…". Both zero when nothing is in flight.
   */
  addProgress: { done: number; total: number };
  /**
   * Keys that made it into the library, across every attempt. The caller drops
   * these from its list: a row already added is not something the reader can
   * act on, and leaving it listed buries the handful that still need attention.
   */
  addedKeys: Set<string>;
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
  const { rows, keyOf, toAddArgs, startsUnticked, defaultStatusOf, onAdded } = options;

  const [statusByKey, setStatusByKey] = useState<Record<string, LibraryStatus>>({});
  // Split into "what this row defaults to" and "what the reader chose", so rows
  // arriving mid-review get their default without disturbing existing choices.
  // A single Set rebuilt per batch would wipe them.
  const [defaultUnticked, setDefaultUnticked] = useState<Set<string>>(new Set());
  const [defaultStatusByKey, setDefaultStatusByKey] = useState<Record<string, LibraryStatus>>({});
  const [tickOverrides, setTickOverrides] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [addProgress, setAddProgress] = useState({ done: 0, total: 0 });
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);

  // The reader's own choice first, then whatever the file said, then New.
  function statusFor(key: string): LibraryStatus {
    return statusByKey[key] ?? defaultStatusByKey[key] ?? 'queued';
  }

  function isTicked(key: string): boolean {
    return tickOverrides[key] ?? !defaultUnticked.has(key);
  }

  /**
   * Walks on from whatever the row currently shows, file-supplied or not. A row
   * that arrived as 'abandoned' isn't in the cycle at all, so indexOf gives -1
   * and the next click lands on the first entry — which is the way out of a
   * status the button can't otherwise reach.
   */
  function cycleStatus(key: string) {
    const index = IMPORT_STATUS_CYCLE.indexOf(statusFor(key));
    const next = IMPORT_STATUS_CYCLE[(index + 1) % IMPORT_STATUS_CYCLE.length];
    setStatusByKey((current) => ({ ...current, [key]: next }));
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
    if (startsUnticked) {
      setDefaultUnticked((current) => {
        const next = new Set(current);
        for (const row of newRows) {
          if (startsUnticked(row)) next.add(keyOf(row));
          else next.delete(keyOf(row));
        }
        return next;
      });
    }

    if (defaultStatusOf) {
      setDefaultStatusByKey((current) => {
        const next = { ...current };
        for (const row of newRows) {
          const status = defaultStatusOf(row);
          if (status) next[keyOf(row)] = status;
          else delete next[keyOf(row)];
        }
        return next;
      });
    }
  }

  /** Wipes every default and choice — for starting an import over. */
  function clearSelection() {
    setStatusByKey({});
    setDefaultUnticked(new Set());
    setDefaultStatusByKey({});
    setTickOverrides({});
    setAddedKeys(new Set());
    setAddError(null);
  }

  const selected = rows.filter((row) => isTicked(keyOf(row)));

  async function confirm(): Promise<boolean> {
    if (selected.length === 0) return true;
    setAdding(true);
    setAddProgress({ done: 0, total: selected.length });
    setAddError(null);
    try {
      // mapWithConcurrency rejects on first failure, so each add is wrapped to
      // keep allSettled semantics: one book that won't upsert must not discard
      // the rest of a 200-row import.
      const outcomes = await mapWithConcurrency(selected, ADD_CONCURRENCY, async (row) => {
        const args = toAddArgs(row);
        if (!args) return null;
        try {
          // enrich: false -- the rows carry everything the resolve step found,
          // and letting the server chase the rest cost a provider round trip
          // per book, which is what made a 300-book add take minutes (LOS-202).
          const { book } = await addToLibrary(args.slug, statusFor(keyOf(row)), args.rawFields, {
            enrich: false,
          });
          return book.id;
        } catch {
          return null;
        } finally {
          // Counted as each row settles, failures included: this reports work
          // done, not work succeeded, so the bar cannot stall on a bad row.
          setAddProgress((current) => ({ ...current, done: current.done + 1 }));
        }
      });

      const addedIds = outcomes.filter((id): id is number => id !== null);
      const added = addedIds.length;

      // Recorded whatever the outcome, so the caller can drop these rows from
      // its list. Accumulated rather than replaced: a retry of the failures
      // must not forget what the first attempt already got in.
      const landedKeys = selected.filter((_, i) => outcomes[i] !== null).map(keyOf);
      if (landedKeys.length > 0) {
        setAddedKeys((current) => new Set([...current, ...landedKeys]));
      }

      // One call for everything that landed, rather than one per book as the
      // add path used to do: the model can only group books it sees together
      // (LOS-197). Fire and forget — tagging must not delay or fail an import,
      // and the backfill picks up anything missed.
      if (added > 0) void categorizeBooks(addedIds).catch(() => {});

      if (added > 0) onAdded?.(added);
      if (added < selected.length) {
        // Rows that landed stop being selected, so the count and any retry
        // cover only the failures. Without this the button still offered to add
        // all five after three of them were already in (LOS-198).
        setTickOverrides((current) => ({
          ...current,
          ...Object.fromEntries(landedKeys.map((key) => [key, false])),
        }));

        // Only the failure. What landed is the caller's to report — CsvImportModal
        // states it in the summary, and saying it twice read as two outcomes.
        setAddError(
          added === 0
            ? "Couldn't add those books — please try again."
            : `${selected.length - added} of ${selected.length} couldn't be added — you can retry them.`,
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
      setAddProgress({ done: 0, total: 0 });
    }
  }

  return {
    statusFor,
    isTicked,
    selectedCount: selected.length,
    cycleStatus,
    toggle,
    adding,
    addProgress,
    addedKeys,
    addError,
    confirm,
    registerRows,
    clearSelection,
  };
}
