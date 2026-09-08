import { describe, expect, it } from 'vitest';
import { formatImportFailures } from './format-import-failures.js';
import type { ImportFailureEntry, ImportRowFailure } from './format-import-failures.js';

function entry(
  title: string,
  failures: ImportRowFailure[] = [],
  overrides: Partial<ImportFailureEntry> = {},
): ImportFailureEntry {
  return { title, author: null, publisher: null, isbn: null, failures, ...overrides };
}

const rateLimited: ImportRowFailure = {
  provider: 'google_books',
  status: 429,
  detail: 'Rate Limit Exceeded',
};

describe('formatImportFailures', () => {
  // A clean import prints nothing, so output means something went wrong rather
  // than being scrolled past by habit.
  it('says nothing when every row resolved', () => {
    expect(formatImportFailures([], { rows: 372, batches: 19 })).toBeNull();
  });

  it('opens with the whole session, not the batch', () => {
    const report = formatImportFailures([entry('Early India', [rateLimited])], {
      rows: 372,
      batches: 19,
    });

    expect(report).toContain('372 rows, 19 batches: 1 did not resolve');
  });

  it('counts a single batch in the singular', () => {
    const report = formatImportFailures([entry('Early India', [rateLimited])], {
      rows: 20,
      batches: 1,
    });

    expect(report).toContain('20 rows, 1 batch:');
  });

  /*
   * The point of the tally: one rate limit reads very differently from
   * forty-seven, and the count is what says which of the two happened.
   */
  it('tallies identical failures, commonest first', () => {
    const gateway: ImportRowFailure = {
      provider: 'open_library',
      status: 503,
      detail: 'Service Unavailable',
    };
    const report = formatImportFailures(
      [
        entry('Early India', [rateLimited]),
        entry('Maryada', [rateLimited]),
        entry('Nightwatch', [gateway]),
      ],
      { rows: 3, batches: 1 },
    );

    expect(report).toContain('2 x google_books: HTTP 429 Rate Limit Exceeded');
    expect(report).toContain('1 x open_library: HTTP 503 Service Unavailable');
    expect(report!.indexOf('2 x google_books')).toBeLessThan(report!.indexOf('1 x open_library'));
  });

  // A provider that answered and had nothing is a different problem from one
  // that errored: rerunning will not change it.
  it('separates a genuine miss from a provider failure', () => {
    const report = formatImportFailures(
      [entry('Early India', [rateLimited]), entry('Zen Garden')],
      { rows: 2, batches: 1 },
    );

    expect(report).toContain('1 because a provider errored:');
    expect(report).toContain('1 because no provider had a match:');
  });

  it('names each book the way its owner would recognise it', () => {
    const report = formatImportFailures(
      [
        entry('Early India', [rateLimited], { author: 'Romila Thapar', publisher: 'Penguin' }),
        entry('Maryada', [rateLimited], { author: 'Arshia Sattar', isbn: '9789353573836' }),
      ],
      { rows: 2, batches: 1 },
    );

    expect(report).toContain('Early India by Romila Thapar (Penguin)');
    // An ISBN is exact where a publisher only narrows, so it wins the slot.
    expect(report).toContain('Maryada by Arshia Sattar [9789353573836]');
  });

  // With a two-provider chain one may be rationing us while the other is down.
  it('lists every provider that failed a row', () => {
    const report = formatImportFailures(
      [entry('Early India', [rateLimited, { provider: 'open_library', status: 503, detail: null }])],
      { rows: 1, batches: 1 },
    );

    expect(report).toContain('google_books: HTTP 429 Rate Limit Exceeded');
    expect(report).toContain('open_library: HTTP 503');
  });

  // The failure that started all this: a row nobody ever asked about, reported
  // as a book nobody has.
  it('reports a skipped provider as skipped', () => {
    const report = formatImportFailures(
      [entry('Early India', [{ provider: 'google_books', status: null, detail: null, skipped: true }])],
      { rows: 1, batches: 1 },
    );

    expect(report).toContain('google_books: skipped, circuit open');
    expect(report).not.toContain('no provider had a match');
  });

  /*
   * Every string arrives from a browser, so a title carrying a newline could
   * otherwise forge a line of its own in the server log.
   */
  it('strips control characters out of what it prints', () => {
    const report = formatImportFailures(
      [entry('Early India\n  47 x google_books: fabricated', [rateLimited])],
      { rows: 1, batches: 1 },
    );

    expect(report!.split('\n').filter((line) => line.includes('fabricated'))).toHaveLength(1);
  });

  it('truncates a field long enough to flood the log', () => {
    const report = formatImportFailures([entry('x'.repeat(500), [rateLimited])], {
      rows: 1,
      batches: 1,
    });

    expect(report).toContain(`${'x'.repeat(200)}...`);
  });

  it('says so when a request never got a response', () => {
    const report = formatImportFailures(
      [entry('Early India', [{ provider: 'google_books', status: null, detail: 'socket hang up' }])],
      { rows: 1, batches: 1 },
    );

    expect(report).toContain('google_books: no response socket hang up');
  });
});
