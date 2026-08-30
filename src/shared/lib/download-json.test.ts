import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { downloadJson, exportFilename } from './download-json';

describe('exportFilename', () => {
  it('dates the file, so several backups can be told apart', () => {
    expect(exportFilename(new Date('2026-08-21T13:45:00Z'))).toBe(
      'bookhunt-library-2026-08-21.zip',
    );
  });
});

describe('downloadJson', () => {
  let created: string[];
  let revoked: string[];
  let clicked: HTMLAnchorElement[];

  beforeEach(() => {
    created = [];
    revoked = [];
    clicked = [];

    // jsdom implements neither, so both are stubbed rather than spied on.
    URL.createObjectURL = vi.fn(() => {
      const url = `blob:mock/${created.length}`;
      created.push(url);
      return url;
    });
    URL.revokeObjectURL = vi.fn((url: string) => {
      revoked.push(url);
    });

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers the file under the name it was given', () => {
    downloadJson('books.json', { books: [] });

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('books.json');
    expect(clicked[0].href).toBe(created[0]);
  });

  // Otherwise the Blob sits in memory for the life of the page, and a reader
  // who exports a few times is holding several copies of their library.
  it('revokes the object URL once the click is done', () => {
    downloadJson('books.json', { books: [] });

    expect(revoked).toEqual(created);
  });

  // Firefox ignores a click on an anchor outside the document, so it has to go
  // in -- and it has to come out again, or every export leaves one behind.
  it('leaves no anchor behind in the document', () => {
    downloadJson('books.json', { books: [] });

    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });
});
