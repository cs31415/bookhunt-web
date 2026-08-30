import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvRows } from './parse-csv';

describe('parseCsvRows', () => {
  it('splits plain rows and cells', () => {
    expect(parseCsvRows('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    expect(parseCsvRows('"Hong Kong, Macau",Frommer\'s')).toEqual([
      ['Hong Kong, Macau', "Frommer's"],
    ]);
  });

  it('keeps newlines inside quoted fields', () => {
    expect(parseCsvRows('"line one\nline two",x')).toEqual([['line one\nline two', 'x']]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsvRows('"He said ""hi""",x')).toEqual([['He said "hi"', 'x']]);
  });

  it('treats CRLF as a single row break', () => {
    expect(parseCsvRows('a,b\r\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('strips a UTF-8 BOM so the first header still matches', () => {
    expect(parseCsvRows('﻿title,author')).toEqual([['title', 'author']]);
  });

  it('drops blank lines', () => {
    expect(parseCsvRows('a,b\n\n\nc,d\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('keeps empty middle cells', () => {
    expect(parseCsvRows("Hong Kong,,Frommer's")).toEqual([['Hong Kong', '', "Frommer's"]]);
  });

  it('returns nothing for empty input', () => {
    expect(parseCsvRows('')).toEqual([]);
  });
});

describe('parseCsv', () => {
  it('reads title, author and publisher', () => {
    const { rows, error } = parseCsv('title,author,publisher\nDune,Frank Herbert,Ace');

    expect(error).toBeNull();
    expect(rows).toEqual([
      { title: 'Dune', author: 'Frank Herbert', publisher: 'Ace', isbn: null, status: null, format: null },
    ]);
  });

  // The case that motivated the feature: a travel guide with no author.
  it('reads a row with an empty author', () => {
    const { rows } = parseCsv("title,author,publisher\nHong Kong,,Frommer's");

    expect(rows).toEqual([
      { title: 'Hong Kong', author: null, publisher: "Frommer's", isbn: null, status: null, format: null },
    ]);
  });

  it('matches headers regardless of case, spacing or order', () => {
    const { rows } = parseCsv(' Publisher , Book Title ,AUTHOR\nAce,Dune,Frank Herbert');

    expect(rows).toEqual([
      { title: 'Dune', author: 'Frank Herbert', publisher: 'Ace', isbn: null, status: null, format: null },
    ]);
  });

  it('accepts a file with only a title column', () => {
    const { rows, error } = parseCsv('title\nDune');

    expect(error).toBeNull();
    expect(rows).toEqual([
      { title: 'Dune', author: null, publisher: null, isbn: null, status: null, format: null },
    ]);
  });

  it('trims surrounding whitespace from values', () => {
    const { rows } = parseCsv('title,author\n  Dune  ,  Frank Herbert  ');

    expect(rows[0]).toEqual({
      title: 'Dune',
      author: 'Frank Herbert',
      publisher: null,
      isbn: null,
      status: null,
      format: null,
    });
  });

  // Two identical lines must survive as two rows — the reader may genuinely own
  // two copies, and silently collapsing them loses data.
  it('keeps duplicate rows', () => {
    const { rows } = parseCsv('title,author\nDune,Frank Herbert\nDune,Frank Herbert');

    expect(rows).toHaveLength(2);
  });

  it('skips rows with no title but keeps the rest', () => {
    const { rows } = parseCsv('title,author\nDune,Frank Herbert\n,Orphan Author\nUbik,Dick');

    expect(rows.map((r) => r.title)).toEqual(['Dune', 'Ubik']);
  });

  it('rejects a file with no title column', () => {
    const { rows, error } = parseCsv('name_of_thing,author\nDune,Frank Herbert');

    expect(rows).toEqual([]);
    expect(error).toContain('title');
  });

  it('rejects an empty file', () => {
    expect(parseCsv('').error).toBe('That file is empty.');
  });

  describe('values containing commas', () => {
    it('reads a quoted value containing a comma as one field', () => {
      const { rows, warning } = parseCsv(
        'title,author,publisher\n"Hong Kong, Macau and Guangzhou",,Frommer\'s',
      );

      expect(warning).toBeNull();
      expect(rows).toEqual([
        {
          title: 'Hong Kong, Macau and Guangzhou',
          author: null,
          publisher: "Frommer's",
          isbn: null,
          status: null,
          format: null,
        },
      ]);
    });

    // Reading this positionally would file "Macau" as the author and silently
    // drop the publisher — wrong data rather than no data.
    it('skips an unquoted comma row rather than shifting its columns', () => {
      const { rows, warning } = parseCsv(
        "title,author,publisher\nHong Kong, Macau,,Frommer's\nDune,Frank Herbert,Ace",
      );

      expect(rows).toEqual([
        { title: 'Dune', author: 'Frank Herbert', publisher: 'Ace', isbn: null, status: null, format: null },
      ]);
      expect(warning).toContain('Skipped 1 row');
      expect(warning).toContain('quotes');
    });

    it('names the offending line numbers, counting the header as line 1', () => {
      const { warning } = parseCsv(
        'title,author,publisher\nDune,Frank Herbert,Ace\nA, B, C, D\nUbik,Dick,Ace',
      );

      expect(warning).toContain('3');
    });

    it('errors rather than warns when every row is ragged', () => {
      const { rows, error } = parseCsv('title,author,publisher\nA, B, C, D\nE, F, G, H');

      expect(rows).toEqual([]);
      expect(error).toContain('quotes');
    });

    it('accepts a row with fewer cells than the header', () => {
      const { rows, warning } = parseCsv('title,author,publisher\nDune,Frank Herbert');

      expect(warning).toBeNull();
      expect(rows).toEqual([
        { title: 'Dune', author: 'Frank Herbert', publisher: null, isbn: null, status: null, format: null },
      ]);
    });
  });

  describe('isbn', () => {
    it('reads an isbn column', () => {
      const { rows } = parseCsv('title,author,isbn\nDune,Frank Herbert,9780441013593');

      expect(rows[0].isbn).toBe('9780441013593');
    });

    it.each([['isbn'], ['ISBN'], ['isbn13'], ['ISBN13'], ['isbn10'], ['ean']])(
      'accepts %s as the header',
      (header) => {
        const { rows } = parseCsv(`title,${header}\nDune,9780441013593`);

        expect(rows[0].isbn).toBe('9780441013593');
      },
    );

    // Goodreads exports carry both; the 13-digit form is unambiguous.
    it('prefers isbn13 when a file has both columns', () => {
      const { rows } = parseCsv('title,isbn,isbn13\nDune,0441013597,9780441013593');

      expect(rows[0].isbn).toBe('9780441013593');
    });

    // The API normalises and validates; the parser just passes it along.
    it('passes punctuation through untouched', () => {
      const { rows } = parseCsv('title,isbn\nDune,"978-0-441-01359-3"');

      expect(rows[0].isbn).toBe('978-0-441-01359-3');
    });

    it('leaves isbn null when the column is absent or blank', () => {
      expect(parseCsv('title\nDune').rows[0].isbn).toBeNull();
      expect(parseCsv('title,isbn\nDune,').rows[0].isbn).toBeNull();
    });
  });

  describe('status', () => {
    // The four the app itself shows, so a reader copies what's on their shelves.
    it.each([
      ['New', 'queued'],
      ['Reading', 'reading'],
      ['Finished', 'finished'],
      ['Abandoned', 'abandoned'],
    ])('reads %s as %s', (label, status) => {
      const { rows, warning } = parseCsv(`title,status\nDune,${label}`);

      expect(rows[0].status).toBe(status);
      expect(warning).toBeNull();
    });

    /*
     * The stored words, which is what our own export writes. Only "queued"
     * differs from its label; without it a file BookHunt produced warned on the
     * way back in, and every New book claimed to be unreadable (LOS-347).
     */
    it.each([
      ['queued', 'queued'],
      ['reading', 'reading'],
      ['finished', 'finished'],
      ['abandoned', 'abandoned'],
    ])('reads our own exported word %s as %s', (word, status) => {
      const { rows, warning } = parseCsv(`title,status\nDune,${word}`);

      expect(rows[0].status).toBe(status);
      expect(warning).toBeNull();
    });

    // Still narrow past our own two names for a state: a guess at another
    // service's vocabulary would file books under a status nobody chose.
    it.each(['read', 'currently-reading', 'did-not-finish', 'to-read'])(
      'still refuses another service’s word %s',
      (word) => {
        const { rows, warning } = parseCsv(`title,status\nDune,${word}`);

        expect(rows[0].status).toBeNull();
        expect(warning).toContain('Didn’t recognise the status'.replace('’', "'"));
      },
    );

    it('matches the value regardless of case or surrounding space', () => {
      const { rows } = parseCsv('title,status\nDune,  FINISHED  \nUbik,reading');

      expect(rows.map((r) => r.status)).toEqual(['finished', 'reading']);
    });

    it('accepts "shelf" as the header', () => {
      expect(parseCsv('title,Shelf\nDune,Finished').rows[0].status).toBe('finished');
    });

    it('leaves status null when the column is absent or blank', () => {
      expect(parseCsv('title\nDune').rows[0].status).toBeNull();
      expect(parseCsv('title,status\nDune,').rows[0].status).toBeNull();
    });

    // Deliberately not translated: "read" means finished on Goodreads and unread
    // to plenty of people, and guessing wrong files the book on the wrong shelf.
    it('warns rather than guesses at a status it does not know', () => {
      const { rows, warning } = parseCsv('title,status\nDune,currently-reading');

      expect(rows[0].status).toBeNull();
      expect(warning).toContain('2'); // the line, counting the header as line 1
      expect(warning).toContain('New, Reading, Finished or Abandoned');
    });

    // A row nobody could shelve is still a row worth importing.
    it('keeps the book when its status is unreadable', () => {
      const { rows, error } = parseCsv('title,author,status\nDune,Frank Herbert,read');

      expect(error).toBeNull();
      expect(rows).toEqual([
        { title: 'Dune', author: 'Frank Herbert', publisher: null, isbn: null, status: null, format: null },
      ]);
    });

    it('reports an unreadable status alongside a skipped row', () => {
      const { warning } = parseCsv(
        'title,status\nDune,nonsense\nHong Kong, Macau,Finished\nUbik,Finished',
      );

      expect(warning).toContain('Skipped 1 row');
      expect(warning).toContain("Didn't recognise the status on 1 row");
    });
  });

  describe('format', () => {
    // The spellings the two exports readers actually bring use: Goodreads
    // writes "Kindle Edition" and "Audio CD", StoryGraph "digital" and "audio".
    it.each([
      ['Kindle Edition', 'ebook'],
      ['ebook', 'ebook'],
      ['digital', 'ebook'],
      ['Audiobook', 'audiobook'],
      ['Audio CD', 'audiobook'],
      ['audio', 'audiobook'],
      ['Paperback', 'physical'],
      ['Hardcover', 'physical'],
      ['Mass Market Paperback', 'physical'],
      ['Unknown Binding', 'physical'],
    ])('reads %s as %s', (word, expected) => {
      const { rows } = parseCsv(`title,format\nDune,${word}`);
      expect(rows[0].format).toBe(expected);
    });

    // Goodreads calls the column Binding, StoryGraph calls it Format.
    it('takes a Goodreads Binding column as-is', () => {
      const { rows, warning } = parseCsv('Title,Author,Binding\nDune,Frank Herbert,Kindle Edition');

      expect(rows[0].format).toBe('ebook');
      expect(warning).toBeNull();
    });

    it('leaves format null when the column is absent or blank', () => {
      expect(parseCsv('title\nDune').rows[0].format).toBeNull();
      expect(parseCsv('title,format\nDune,').rows[0].format).toBeNull();
    });

    // Same treatment as an unreadable status: silently filing it as a paperback
    // would be indistinguishable from having ignored the column.
    it('keeps the book and warns when the format is unreadable', () => {
      const { rows, warning, error } = parseCsv('title,format\nDune,papyrus scroll');

      expect(error).toBeNull();
      expect(rows[0]).toMatchObject({ title: 'Dune', format: null });
      expect(warning).toContain("Didn't recognise the format on 1 row");
    });

    it('reports an unreadable format and status together', () => {
      const { warning } = parseCsv('title,status,format\nDune,nonsense,papyrus');

      expect(warning).toContain("Didn't recognise the status on 1 row");
      expect(warning).toContain("Didn't recognise the format on 1 row");
    });
  });

  it('rejects a file with a header but no usable rows', () => {
    const { rows, error } = parseCsv('title,author\n,\n,');

    expect(rows).toEqual([]);
    expect(error).toContain('No books found');
  });
});
