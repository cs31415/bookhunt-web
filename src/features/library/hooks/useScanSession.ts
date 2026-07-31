import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../api/client';
import { addToLibrary } from '../../../api/library/add-to-library';
import { getBooksByIds } from '../../../api/books/get-books-by-ids';
import { normalizeBooksByIds } from '../../../normalize/books-by-ids';
import {
  MAX_IMAGE_BYTES,
  UPLOAD_CONCURRENCY,
  isAllowedImageType,
  presignUploads,
} from '../../../api/upload/presign';
import { mapWithConcurrency } from '../../../shared/lib/map-with-concurrency';
import { UploadError, uploadToPresigned } from '../../../api/upload/upload-to-presigned';
import { scanShelves } from '../../../api/upload/scan';
import type { RawDetectedBook } from '../../../api/upload/scan';
import { normalizeDetectedBook, rawFieldsForDetected } from '../../../normalize/detected-book';
import type { DetectedBook } from '../../../normalize/detected-book';
import type { BookSummary } from '../../../shared/types/book';
import type { LibraryStatus } from '../../../shared/types/library-status';

export type ScanPhase = 'upload' | 'processing' | 'results' | 'error';

/** AC4: the cycle button walks these three; 'abandoned' isn't offered at import time. */
export const SCAN_STATUS_CYCLE: LibraryStatus[] = ['queued', 'reading', 'finished'];

const GENERIC_ERROR = "Couldn't read your photos — please try again.";
const UPLOAD_ERROR = "Couldn't upload your photos — please try again.";
const RATE_LIMIT_ERROR = 'Too many scans right now — try again in a minute.';
const HEIC_ERROR =
  "HEIC photos aren't supported yet — pick from your photo library, or set Settings › Camera › Formats to “Most Compatible”.";

export interface ScanRow {
  detected: DetectedBook;
  raw: RawDetectedBook;
}

export interface UseScanSessionResult {
  phase: ScanPhase;
  previews: string[];
  rows: ScanRow[];
  error: string | null;
  adding: boolean;
  statusFor: (key: string) => LibraryStatus;
  isTicked: (key: string) => boolean;
  selectedCount: number;
  start: (files: File[]) => void;
  cycleStatus: (key: string) => void;
  toggle: (key: string) => void;
  confirm: () => Promise<void>;
  reset: () => void;
}

function messageFor(error: unknown): string {
  // Distinct copy per phase: an upload that never reached S3 leaves no trace on
  // the API, so telling the user we couldn't "read" their photos points whoever
  // debugs it at entirely the wrong half of the flow.
  if (error instanceof UploadError) return UPLOAD_ERROR;
  if (!(error instanceof ApiError)) return GENERIC_ERROR;
  if (error.status === 429) return RATE_LIMIT_ERROR;
  // 400s are validation messages meant to be actionable — notably the photo-count
  // ceiling, which only the API knows (LOS-163). Surface it rather than keeping a
  // stale copy of the limit here.
  if (error.status === 400 && error.message) {
    return error.message.charAt(0).toUpperCase() + error.message.slice(1) + '.';
  }
  return GENERIC_ERROR;
}

/**
 * Checks what the S3 policy would reject anyway, so an opaque failure becomes an
 * actionable message.
 *
 * One photo per scan (LOS-170): a single image gets the whole prompt and the
 * whole output-token budget, which reads spines materially better than several
 * sharing them. The API still accepts up to 40 keys and chunks them — that
 * capability is exercised by scripts/test-photo-import.js and is not torn out
 * just because this client narrowed its own use of it.
 */
function validate(files: File[]): string | null {
  if (files.length === 0) return null;
  if (files.length > 1) {
    return 'Please choose one photo at a time — a single shelf reads more accurately.';
  }
  for (const file of files) {
    if (!isAllowedImageType(file.type)) {
      // iOS transcodes HEIC to JPEG when `accept` excludes it, so reaching here
      // means a Files-app pick or a desktop drag of a raw .heic.
      const looksHeic = /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
      return looksHeic ? HEIC_ERROR : `${file.name} isn't a JPEG, PNG, or WebP image.`;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return `${file.name} is larger than 10 MB.`;
    }
  }
  return null;
}

export interface UseScanSessionOptions {
  /** Book ids already in the library — detections matching these are dropped (AC11). */
  excludeBookIds: number[];
  /** Fired when a scan settles, with the number of importable books found. */
  onScanComplete?: (count: number) => void;
  /** Fired after books are actually added, so the caller can reload the grid. */
  onAdded?: (count: number) => void;
}

/**
 * Owns the whole photo-import flow. Deliberately lives in LibraryPage rather
 * than inside ScanModal: closing the modal must not abort an in-flight scan
 * (AC7), so the promise has to be held by a component that stays mounted.
 */
export function useScanSession(options: UseScanSessionOptions): UseScanSessionResult {
  const { excludeBookIds, onScanComplete, onAdded } = options;

  const [phase, setPhase] = useState<ScanPhase>('upload');
  const [previews, setPreviews] = useState<string[]>([]);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [statusByKey, setStatusByKey] = useState<Record<string, LibraryStatus>>({});
  const [untickedKeys, setUntickedKeys] = useState<Set<string>>(new Set());

  // Latest values, read from inside the async run without making it a dependency.
  // Synced in an effect rather than during render: the run only reads them from
  // event handlers and resolved promises, both of which happen after commit.
  const excludeRef = useRef(excludeBookIds);
  const completeRef = useRef(onScanComplete);
  useEffect(() => {
    excludeRef.current = excludeBookIds;
    completeRef.current = onScanComplete;
  });

  // Only the newest run may write state; an earlier one that resolves late is ignored.
  const runIdRef = useRef(0);
  const previewsRef = useRef<string[]>([]);

  function releasePreviews() {
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewsRef.current = [];
  }

  useEffect(() => releasePreviews, []);

  function start(files: File[]) {
    if (files.length === 0) return;

    const invalid = validate(files);
    if (invalid) {
      setError(invalid);
      setPhase('error');
      return;
    }

    const runId = ++runIdRef.current;
    releasePreviews();
    const urls = files.map((f) => URL.createObjectURL(f));
    previewsRef.current = urls;

    setPreviews(urls);
    setRows([]);
    setStatusByKey({});
    setUntickedKeys(new Set());
    setError(null);
    setPhase('processing');

    void run(runId, files);
  }

  async function run(runId: number, files: File[]) {
    try {
      const policies = await presignUploads(files.map((f) => ({ contentType: f.type })));
      // Bounded rather than all-at-once: a 40-photo batch shouldn't open 40
      // simultaneous connections and stall the browser's request queue.
      await mapWithConcurrency(policies, UPLOAD_CONCURRENCY, (policy, i) =>
        uploadToPresigned(policy, files[i]),
      );
      const { detectedBooks } = await scanShelves(policies.map((p) => p.key));

      // One batch call resolves every catalog match's slug, cover, and hue.
      const matchedIds = detectedBooks
        .map((b) => b.matchedBookId)
        .filter((id): id is number => id !== undefined);
      const catalogById = new Map<number, BookSummary>();
      if (matchedIds.length > 0) {
        const res = await getBooksByIds(matchedIds);
        for (const book of normalizeBooksByIds(res)) catalogById.set(book.id, book);
      }

      if (runId !== runIdRef.current) return;

      // The API doesn't know what's already in the library, so filter here (AC11).
      const excluded = new Set(excludeRef.current);
      const next: ScanRow[] = detectedBooks
        .filter((raw) => raw.matchedBookId === undefined || !excluded.has(raw.matchedBookId))
        .map((raw) => ({ raw, detected: normalizeDetectedBook(raw, catalogById) }));

      setRows(next);
      setStatusByKey(Object.fromEntries(next.map((r) => [r.detected.key, 'queued' as LibraryStatus])));
      // Unresolved spines start unticked — adding them creates a catalog row with
      // nothing but a title and author.
      setUntickedKeys(
        new Set(next.filter((r) => r.detected.tier === 'unresolved').map((r) => r.detected.key)),
      );
      setPhase('results');
      completeRef.current?.(next.length);
    } catch (e) {
      // Always logged: the on-screen copy is deliberately vague, and an S3
      // failure produces no server-side record to cross-reference.
      console.error('[scan] failed', e);
      if (runId !== runIdRef.current) return;
      setError(messageFor(e));
      setPhase('error');
    }
  }

  function statusFor(key: string): LibraryStatus {
    return statusByKey[key] ?? 'queued';
  }

  function isTicked(key: string): boolean {
    return !untickedKeys.has(key);
  }

  function cycleStatus(key: string) {
    setStatusByKey((current) => {
      const index = SCAN_STATUS_CYCLE.indexOf(current[key] ?? 'queued');
      return { ...current, [key]: SCAN_STATUS_CYCLE[(index + 1) % SCAN_STATUS_CYCLE.length] };
    });
  }

  // Tick state is tracked separately from status so unticking and re-ticking
  // doesn't silently reset a status the user already chose.
  function toggle(key: string) {
    setUntickedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const selected = rows.filter((r) => !untickedKeys.has(r.detected.key));

  async function confirm() {
    if (selected.length === 0) return;
    setAdding(true);
    try {
      // allSettled, not all: one book that fails to upsert shouldn't discard the rest.
      const results = await Promise.allSettled(
        selected.map((row) =>
          addToLibrary(
            row.detected.slug,
            statusFor(row.detected.key),
            rawFieldsForDetected(row.detected, row.raw),
          ),
        ),
      );
      const added = results.filter((r) => r.status === 'fulfilled').length;
      if (added < selected.length) {
        setError(
          added === 0
            ? "Couldn't add those books — please try again."
            : `Added ${added} of ${selected.length} books; the rest failed.`,
        );
      }
      if (added > 0) onAdded?.(added);
    } finally {
      setAdding(false);
    }
  }

  function reset() {
    runIdRef.current++;
    releasePreviews();
    setPreviews([]);
    setRows([]);
    setStatusByKey({});
    setUntickedKeys(new Set());
    setError(null);
    setPhase('upload');
  }

  return {
    phase,
    previews,
    rows,
    error,
    adding,
    statusFor,
    isTicked,
    selectedCount: selected.length,
    start,
    cycleStatus,
    toggle,
    confirm,
    reset,
  };
}
