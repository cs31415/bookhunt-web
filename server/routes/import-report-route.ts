import type { Request, RequestHandler, Response } from 'express';
import { formatImportFailures } from '../lib/format-import-failures.js';
import type { ImportFailureEntry, ImportRowFailure } from '../lib/format-import-failures.js';

/**
 * POST /bff/import/report — what an import could not resolve (LOS-394).
 *
 * The browser is the only party that can see a whole import: the API answers
 * one batch per request, and a summary written there printed once per POST --
 * nineteen fragments for a 372-row file, none of them saying how the import
 * went. So the browser gathers the rows that came back empty and posts them
 * here, and the report is printed in the BFF's log where the other request
 * lines are, rather than in the reader's own console.
 *
 * Answers 204 whatever it decides to print. Nothing about a diagnostic is worth
 * failing a reader's import over, so the client sends this and forgets it.
 */
export const importReportRoute: RequestHandler = (req: Request, res: Response) => {
  const report = parseReport(req.body);
  if (report) {
    const text = formatImportFailures(report.entries, report.totals);
    if (text) console.warn(`[csv-import] ${text}`);
  }
  res.status(204).end();
};

/** Rows one import can report, matching MAX_CSV_ROWS in the client. */
const MAX_ENTRIES = 1000;

/** Providers that can fail one row. Two today; the cap only stops a forged list. */
const MAX_FAILURES_PER_ROW = 4;

interface Report {
  entries: ImportFailureEntry[];
  totals: { rows: number; batches: number };
}

/**
 * The posted body as something safe to print, or null.
 *
 * Everything here arrives from a browser, so nothing is taken on trust: each
 * field is checked for its own type and the lists are bounded. The formatter
 * strips control characters from the strings themselves. Bodies stay raw bytes
 * through the BFF (see create-app), so this parses its own.
 */
function parseReport(body: unknown): Report | null {
  if (!Buffer.isBuffer(body) || body.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString('utf8'));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const { entries, rows, batches } = parsed as Record<string, unknown>;
  if (!Array.isArray(entries)) return null;

  return {
    entries: entries.slice(0, MAX_ENTRIES).map(toEntry).filter((entry) => entry !== null),
    totals: { rows: count(rows), batches: count(batches) },
  };
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function toEntry(value: unknown): ImportFailureEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const entry = value as Record<string, unknown>;
  const title = text(entry.title);
  // A row with no title is not a book anyone could act on.
  if (!title) return null;

  const failures = Array.isArray(entry.failures) ? entry.failures : [];
  return {
    title,
    author: text(entry.author),
    publisher: text(entry.publisher),
    isbn: text(entry.isbn),
    failures: failures
      .slice(0, MAX_FAILURES_PER_ROW)
      .map(toFailure)
      .filter((failure) => failure !== null),
  };
}

function toFailure(value: unknown): ImportRowFailure | null {
  if (typeof value !== 'object' || value === null) return null;
  const failure = value as Record<string, unknown>;
  const provider = text(failure.provider);
  if (!provider) return null;

  return {
    provider,
    status: typeof failure.status === 'number' ? failure.status : null,
    detail: text(failure.detail),
    ...(failure.skipped === true && { skipped: true }),
  };
}
