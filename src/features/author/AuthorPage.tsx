import { useNavigate, useParams } from 'react-router-dom';
import { BookCard } from '../../shared/components/BookCard/BookCard';
import { SectionHead } from '../../shared/components/SectionHead/SectionHead';
import { buildBookHref } from '../../shared/lib/build-book-href';
import { pluralize } from '../../shared/lib/text';
import { useAuthorData } from './hooks/useAuthorData';
import styles from './AuthorPage.module.css';

/** Ancient authors (born before year 1000) read as "121 CE"; modern ones as the plain year. */
function formatBirthYear(year: number): string {
  return year < 1000 ? `${year} CE` : String(year);
}

/**
 * Provider-neutral hero meta line, derived only from the author's own fields —
 * "{country} · b. {year}", or whichever piece is known, or "Author" when neither is.
 */
function metaLine(country: string | null, birthYear: number | null): string {
  const parts: string[] = [];
  if (country) parts.push(country);
  if (birthYear != null) parts.push(`b. ${formatBirthYear(birthYear)}`);
  return parts.length > 0 ? parts.join(' · ') : 'Author';
}

export function AuthorPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { author, works, notFound, error } = useAuthorData(slug);

  if (notFound) {
    return <div className={styles.notFound}>Author not found.</div>;
  }

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  // Initial load (no author yet) blanks the page rather than flashing a spinner.
  if (!author) {
    return <div className={styles.page} />;
  }

  return (
    <div className={`${styles.page} fade-up`}>
      <div className={styles.hero}>
        <div className={styles.portrait}>
          author
          <br />
          portrait
        </div>
        <div>
          <div className={styles.eyebrow}>{metaLine(author.country, author.birthYear)}</div>
          <h1 className={styles.name}>{author.name}</h1>
          {author.bio && <p className={styles.bio}>{author.bio}</p>}
          <div className={styles.count}>
            {works.length} {pluralize(works.length, 'book')}
          </div>
        </div>
      </div>

      <SectionHead eyebrow="Bibliography" title={`Books by ${author.name}`} />
      <div className={styles.grid}>
        {works.map((work) => (
          <BookCard
            key={work.book.id}
            book={work.book}
            status={work.status}
            onClick={() => navigate(buildBookHref(work.book))}
          />
        ))}
      </div>
    </div>
  );
}
