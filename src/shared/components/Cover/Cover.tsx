import { useEffect, useRef, useState } from 'react';
import type { BookSummary } from '../../types/book';
import { getSurname, wrapTitle } from '../../lib/text';
import { repairCover } from '../../../api/books/repair-cover';
import styles from './Cover.module.css';

type CoverBook = Pick<BookSummary, 'title' | 'authorName' | 'coverUrl' | 'hue' | 'year'> &
  // Optional: the CSV import's placeholder rows have no slug yet, and a cover
  // cannot be repaired without one to address.
  Partial<Pick<BookSummary, 'slug'>>;

/**
 * How long a cover gets before the reader stops waiting for it.
 *
 * `onError` is not enough on its own. When a cover host stops accepting
 * connections rather than refusing them — which is what covers.openlibrary.org
 * did (LOS-272) — no error ever fires, and the browser sits on its own connect
 * timeout showing a bare coloured box.
 */
const PATIENCE_MS = 3000;

export interface CoverProps {
  book: CoverBook;
  /** Fixed pixel width (height = 1.5x), or a CSS width string (e.g. '100%') for a fluid 2:3 box. */
  width?: number | string;
  onClick?: () => void;
}

function wrapDimensions(width: number | string): {
  width: number | string;
  height?: number;
  aspectRatio?: string;
} {
  if (typeof width === 'number') {
    return { width, height: Math.round(width * 1.5) };
  }
  return { width, aspectRatio: '2 / 3' };
}

export function Cover({ book, width = 132, onClick }: CoverProps) {
  const [imgOk, setImgOk] = useState(true);
  const [loaded, setLoaded] = useState(false);
  // What to actually load. Starts as the catalog's URL and becomes the repaired
  // one, so a fixed cover appears without a reload.
  const [src, setSrc] = useState(book.coverUrl);
  const dimensions = wrapDimensions(width);

  // A new book in the same slot — the grid reuses these — starts over.
  const [syncedUrl, setSyncedUrl] = useState(book.coverUrl);
  if (book.coverUrl !== syncedUrl) {
    setSyncedUrl(book.coverUrl);
    setSrc(book.coverUrl);
    setImgOk(true);
    setLoaded(false);
  }

  /**
   * Whether the browser has any reason to have started fetching yet.
   *
   * The images are `loading="lazy"`, so one far down a sixty-book grid is not
   * requested at all until it nears the viewport. Timing those out on mount
   * would replace most of a shelf with procedural covers, and ask the API to
   * repair covers nothing had tried to load.
   *
   * No IntersectionObserver — jsdom, chiefly — means assume visible, which is
   * how this behaved before the timer existed.
   */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (visible) return;
    const node = wrapRef.current;
    if (!node) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  /**
   * Gives the image PATIENCE_MS to arrive, then gives up on it and asks the API
   * for a cover that works. The fallback is immediate and does not wait on the
   * repair: the reader is owed a cover now, and the repair is for whoever opens
   * this book next.
   *
   * `loaded` is what stops the timer — not `imgOk`, which stays true for a
   * cover that is on screen and would fire this at three seconds anyway.
   */
  useEffect(() => {
    if (!src || !visible || loaded || !imgOk) return;

    const timer = setTimeout(() => {
      setImgOk(false);
      if (!book.slug) return;
      void repairCover(book.slug).then((result) => {
        if (result?.coverUrl && result.coverUrl !== src) {
          setSrc(result.coverUrl);
          setImgOk(true);
        }
      });
    }, PATIENCE_MS);

    return () => clearTimeout(timer);
  }, [src, visible, loaded, imgOk, book.slug]);

  return (
    <div
      className={styles.cover}
      ref={wrapRef}
      onClick={onClick}
      style={{
        ['--cover-bg' as string]: book.hue,
        background: book.hue,
        cursor: onClick ? 'pointer' : 'default',
        ...dimensions,
      }}
    >
      {src && imgOk ? (
        <img
          className={styles.image}
          src={src}
          alt={book.title}
          loading="lazy"
          onError={() => setImgOk(false)}
          onLoad={(event) => {
            // OpenLibrary's covers-by-ISBN endpoint returns a 1x1 placeholder
            // (HTTP 200, so onError never fires) when it has no real cover.
            if (event.currentTarget.naturalWidth <= 1) setImgOk(false);
            else setLoaded(true);
          }}
        />
      ) : (
        <ProceduralCover book={book} />
      )}
    </div>
  );
}

function ProceduralCover({ book }: { book: CoverBook }) {
  const VB = 200;
  const VBH = 300;
  const lines = wrapTitle(book.title, 13);
  const maxLen = Math.max(...lines.map((line) => line.length), 1);
  const byLines = lines.length >= 5 ? 20 : lines.length === 4 ? 23 : 26;
  const byWidth = 158 / (0.52 * maxLen);
  const fontSize = Math.max(15, Math.min(byLines, byWidth));
  const lineHeight = fontSize * 1.06;
  const blockHeight = lines.length * lineHeight;
  const startY = VBH / 2 - blockHeight / 2 + fontSize * 0.78;

  return (
    <svg
      viewBox={`0 0 ${VB} ${VBH}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`Cover for ${book.title}`}
      style={{ display: 'block' }}
    >
      <rect x="0" y="0" width={VB} height={VBH} fill={book.hue} />
      <text
        x="20"
        y="40"
        fill="rgba(255,255,255,.82)"
        fontFamily="var(--mono)"
        fontSize="11"
        letterSpacing="1.4"
        style={{ textTransform: 'uppercase' }}
      >
        {getSurname(book.authorName).toUpperCase()}
      </text>
      <line x1="20" y1="50" x2="74" y2="50" stroke="rgba(255,255,255,.55)" strokeWidth="1.3" />
      <text x="20" fill="#fff" fontFamily="var(--cover)" fontSize={fontSize} fontWeight="600">
        {lines.map((line, index) => (
          <tspan key={index} x="20" y={startY + index * lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
      <line
        x1="20"
        y1={VBH - 38}
        x2={VB - 20}
        y2={VBH - 38}
        stroke="rgba(255,255,255,.4)"
        strokeWidth="1.1"
      />
      <text
        x="20"
        y={VBH - 22}
        fill="rgba(255,255,255,.78)"
        fontFamily="var(--mono)"
        fontSize="11"
        letterSpacing="1.4"
      >
        {book.year}
      </text>
    </svg>
  );
}
