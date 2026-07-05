import { useState } from 'react';
import type { BookSummary } from '../../types/book';
import { getSurname, pickFontSize, wrapTitle } from '../../lib/text';
import styles from './Cover.module.css';

type CoverBook = Pick<BookSummary, 'title' | 'authorName' | 'coverUrl' | 'hue' | 'year'>;

export interface CoverProps {
  book: CoverBook;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_DIMENSIONS: Record<
  NonNullable<CoverProps['size']>,
  { width: number; height: number }
> = {
  sm: { width: 60, height: 90 },
  md: { width: 120, height: 180 },
  lg: { width: 160, height: 240 },
};

export function Cover({ book, size = 'md' }: CoverProps) {
  const [failed, setFailed] = useState(false);
  const { width, height } = SIZE_DIMENSIONS[size];

  if (book.coverUrl && !failed) {
    return (
      <img
        className={styles.image}
        style={{ width, height }}
        src={book.coverUrl}
        alt={book.title}
        onError={() => setFailed(true)}
      />
    );
  }

  return <ProceduralCover book={book} width={width} height={height} />;
}

function ProceduralCover({
  book,
  width,
  height,
}: {
  book: CoverBook;
  width: number;
  height: number;
}) {
  const maxCharsPerLine = Math.round(width / 6.5);
  const lines = wrapTitle(book.title, maxCharsPerLine);
  const longestLineLen = Math.max(...lines.map((line) => line.length));
  const fontSize = pickFontSize(lines.length, longestLineLen);
  const lineHeight = fontSize * 1.15;
  const titleStartY = height / 2 - ((lines.length - 1) * lineHeight) / 2;

  return (
    <svg
      className={styles.procedural}
      style={{ width, height }}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Cover for ${book.title}`}
    >
      <rect width={width} height={height} fill={book.hue} />
      {lines.map((line, index) => (
        <text
          key={index}
          x={width / 2}
          y={titleStartY + index * lineHeight}
          fontSize={fontSize}
          textAnchor="middle"
          className={styles.title}
        >
          {line}
        </text>
      ))}
      <text x={width / 2} y={height - 22} textAnchor="middle" className={styles.author}>
        {getSurname(book.authorName)}
      </text>
      {book.year != null && (
        <text x={10} y={height - 8} className={styles.year}>
          {book.year}
        </text>
      )}
    </svg>
  );
}
