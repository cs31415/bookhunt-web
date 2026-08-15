import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BookCard } from '../../shared/components/BookCard/BookCard';
import { SectionHead } from '../../shared/components/SectionHead/SectionHead';
import { buildBookHref } from '../../shared/lib/build-book-href';
import { pluralize } from '../../shared/lib/text';
import { RichText } from '../../shared/lib/rich-text';
import { useAuthorData } from './hooks/useAuthorData';
import { FavoriteButton } from '../../shared/components/FavoriteButton/FavoriteButton';
import { setAuthorFavorite } from '../../api/authors/set-favorite';
import { useAuth } from '../auth/AuthContext';
import { toast } from '../../shared/toast/toast-store';
import styles from './AuthorPage.module.css';

/** Ancient authors (born before year 1000) read as "121 CE"; modern ones as the plain year. */
function formatBirthYear(year: number): string {
  return year < 1000 ? `${year} CE` : String(year);
}

/**
 * Provider-neutral hero meta line, derived only from the author's own fields —
 * "b. {year}", or "Author" when even that is unknown.
 *
 * Country used to lead this line. It was dropped in LOS-228: no book provider
 * could supply it, so it existed only to make an LLM call for one word, and it
 * had reached 23 of 303 authors.
 */
function metaLine(birthYear: number | null): string {
  if (birthYear == null) return 'Author';
  return `b. ${formatBirthYear(birthYear)}`;
}

export function AuthorPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { author, works, isFavorite, notFound, error } = useAuthorData(slug);
  const { isAuthenticated } = useAuth();

  // An override rather than a mirrored copy: null means "whatever the server
  // said", so a reload or a slug change needs no synchronising effect. A failed
  // request clears it, falling back to the fetched value -- the same contract
  // as the library's flags in useEntryFlags.
  const [override, setOverride] = useState<boolean | null>(null);
  const favorite = override ?? isFavorite;

  async function toggleFavorite(next: boolean) {
    setOverride(next);
    try {
      await setAuthorFavorite(slug, next);
    } catch {
      setOverride(null);
      toast({ text: next ? 'Could not favourite this author' : 'Could not remove this author' });
    }
  }

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
          <div className={styles.eyebrow}>{metaLine(author.birthYear)}</div>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{author.name}</h1>
            {/* Signed out there is nowhere to store the answer, so the control
                is absent rather than present and failing. */}
            {isAuthenticated && (
              <FavoriteButton isFavorite={favorite} onToggle={toggleFavorite} />
            )}
          </div>
          {author.bio && <RichText className={styles.bio} text={author.bio} />}
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
