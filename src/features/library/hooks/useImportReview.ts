import { useState } from 'react';
import { addToLibrary } from '../../../api/library/add-to-library';
import type { AddToLibraryRawFields } from '../../../api/library/add-to-library';
import { mapWithConcurrency } from '../../../shared/lib/map-with-concurrency';
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
  resetSelection: (rows: TRow[]) => void;
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
  const [untickedKeys, setUntickedKeys] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  function statusFor(key: string): LibraryStatus {
    return statusByKey[key] ?? 'queued';
  }

  function isTicked(key: string): boolean {
    return !untickedKeys.has(key);
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
    setUntickedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function resetSelection(nextRows: TRow[]) {
    setStatusByKey({});
    setUntickedKeys(new Set(nextRows.filter((r) => startsUnticked?.(r)).map(keyOf)));
    setAddError(null);
  }

  const selected = rows.filter((row) => !untickedKeys.has(keyOf(row)));

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
        return false;
      }
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
    resetSelection,
  };
}
