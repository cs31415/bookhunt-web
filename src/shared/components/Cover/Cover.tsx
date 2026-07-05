import { useState } from 'react';
import type { BookSummary } from '../../types/book';
import { getSurname, wrapTitle } from '../../lib/text';
import styles from './Cover.module.css';

type CoverBook = Pick<BookSummary, 'title' | 'authorName' | 'coverUrl' | 'hue' | 'year'>;

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
  const dimensions = wrapDimensions(width);

  return (
    <div
      className={styles.cover}
      onClick={onClick}
      style={{
        ['--cover-bg' as string]: book.hue,
        background: book.hue,
        cursor: onClick ? 'pointer' : 'default',
        ...dimensions,
      }}
    >
      {book.coverUrl && imgOk ? (
        <img
          className={styles.image}
          src={book.coverUrl}
          alt={book.title}
          loading="lazy"
          onError={() => setImgOk(false)}
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
