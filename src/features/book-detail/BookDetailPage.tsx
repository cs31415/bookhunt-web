import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Hero } from './components/Hero/Hero';
import { SpecificationsCard } from './components/SpecificationsCard/SpecificationsCard';
import { ReviewEditor } from './components/ReviewEditor/ReviewEditor';
import { VisitorReview } from './components/VisitorReview/VisitorReview';
import { useVisitorEntry } from './hooks/useVisitorEntry';
import { useAuth } from '../auth/AuthContext';
import { Sidebar } from './components/Sidebar/Sidebar';
import { RelatedReads } from './components/RelatedReads/RelatedReads';
import { useBookDetailData } from './hooks/useBookDetailData';
import { useThemes } from './hooks/useThemes';
import { useRelatedReads } from './hooks/useRelatedReads';
import { addToLibrary } from '../../api/library/add-to-library';
import type { AddToLibraryRawFields } from '../../api/library/add-to-library';
import { setFavorite } from '../../api/library/set-favorite';
import { updateEntry } from '../../api/library/update-entry';
import { removeEntry } from '../../api/library/remove-entry';
import { ConfirmRemoveModal } from '../../shared/components/ConfirmRemoveModal/ConfirmRemoveModal';
import { toast } from '../../shared/toast/toast-store';
import { addRelated } from '../../api/library/add-related';
import { removeRelated } from '../../api/library/remove-related';
import type { BookDetail } from '../../normalize/book-detail';
import type { LibraryStatus } from '../../shared/types/library-status';
import { buildBookHref } from '../../shared/lib/build-book-href';
import styles from './BookDetailPage.module.css';

function rawFieldsFor(book: BookDetail): AddToLibraryRawFields {
  return {
    title: book.title,
    authorName: book.authorName,
    googleBooksId: book.googleBooksId,
    year: book.year,
    publisher: book.publisher,
    pages: book.pages,
    rating: book.rating,
    subjects: book.subjects,
    blurb: book.blurb,
    coverUrl: book.coverUrl,
    isbn13: book.isbn13,
    language: book.language,
  };
}

export function BookDetailPage() {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const authorSlug = searchParams.get('a') ?? undefined;
  const pid = searchParams.get('pid') ?? undefined;
  /**
   * Whose copy of this book to show (LOS-360).
   *
   * Set when a visitor arrived from someone's shelf. The page then reads their
   * entry instead of the caller's and offers none of the caller's controls --
   * this is somebody else's copy, not a second place to edit your own.
   */
  const visitingHandle = searchParams.get('u') ?? undefined;
  const navigate = useNavigate();

  const { detail, authorBio, authorWorks, relatedBooks, notFound, error, reload } = useBookDetailData(slug, {
    authorSlug,
    pid,
  });
  const book = detail?.book ?? null;
  // null means "whatever the server said", so a reload needs no synchronising
  // effect and a failed toggle needs no remembered value to restore.
  const [favoriteOverride, setFavoriteOverride] = useState<boolean | null>(null);
  /**
   * Whose entry the page is about. Under `?u=` it is theirs, and every control
   * that would write goes with it -- reading someone's review beside a box that
   * saves over your own is the worst version of this (LOS-360).
   */
  const visitorEntry = useVisitorEntry(visitingHandle, book?.id);
  const visiting = Boolean(visitingHandle);

  /**
   * Whether to show the parts of this page that are about what *this* reader
   * did with the book, rather than about the book.
   *
   * Two sections qualify, and both fail the same way without a reader. My
   * review offers an editor that cannot save -- writing one needs a library
   * entry, which needs an account (LOS-364). Related reads is mostly the
   * curating of your own picks: an Add related button, a picker, and a hint
   * telling you to add the book so you can curate it (LOS-365).
   *
   * Excluded under `?u=` for a different reason: there the page is about
   * somebody else's copy, and the reader's own working area does not belong
   * beside it.
   */
  const { isAuthenticated } = useAuth();
  const showOwnSections = isAuthenticated && !visiting;

  const fetchedEntry = detail?.libraryEntry;
  const libraryEntry = fetchedEntry
    ? { ...fetchedEntry, isFavorite: favoriteOverride ?? fetchedEntry.isFavorite }
    : undefined;
  const [addingToLibrary, setAddingToLibrary] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const { themes, moods, loading: themesLoading } = useThemes(
    book?.cataloged ? book.id : null,
    book?.genres ?? [],
    book?.themes ?? [],
    book?.moods ?? [],
    book?.cataloged ?? true,
    book?.title ?? '',
    book?.authorName ?? '',
  );
  const relatedReads = useRelatedReads(
    relatedBooks,
    libraryEntry?.userRelatedIds ?? [],
    book?.relatedIds ?? [],
  );

  if (notFound) {
    return <div className={styles.notFound}>Book not found.</div>;
  }

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  // Only the initial load (no book yet) blanks the page — background
  // reloads after a mutation keep showing the stale-then-fresh book so
  // typing a review doesn't flash the whole page on every save.
  if (!book) {
    return <div className={styles.page} />;
  }

  // Ensures the book has a real catalog row before an action that needs one
  // (rating, review, toggling into the library) — the only place a
  // not-yet-cataloged book gets written to the catalog, distinct from just
  // viewing it. Returns the real {id, slug}, which may differ from the
  // pseudo reference the ephemeral page was viewed under.
  async function ensureAddedToLibrary(status: LibraryStatus = 'queued') {
    if (!book) throw new Error('No book loaded');
    const { book: realBook } = await addToLibrary(
      book.slug,
      status,
      book.cataloged ? undefined : rawFieldsFor(book),
    );
    return realBook;
  }

  async function handleToggleLibrary() {
    if (!book) return;
    if (libraryEntry) {
      await removeEntry(book.id);
      reload();
      return;
    }
    setAddingToLibrary(true);
    try {
      const wasEphemeral = !book.cataloged;
      const real = await ensureAddedToLibrary('queued');
      if (wasEphemeral) {
        navigate(buildBookHref({ ...book, slug: real.slug }), { replace: true });
      } else {
        reload();
      }
    } finally {
      setAddingToLibrary(false);
    }
  }

  /**
   * Removal from this page. Split out of handleToggleLibrary, whose remove
   * branch was unreachable: the button that called it only rendered when the
   * book was *not* in the library, so a book already on the shelf had no way
   * off it from here (LOS-206).
   */
  async function handleRemoveFromLibrary() {
    if (!book) return;
    await removeEntry(book.id);
    setConfirmingRemove(false);
    toast({ text: `Removed \u201C${book.title}\u201D from your library` });
    reload();
  }

  async function handleStatusChange(status: LibraryStatus) {
    if (!book) return;
    await updateEntry(book.id, { status });
    reload();
  }

  // PUT /library/:bookId 404s if the entry doesn't exist yet, so rating/review
  // changes add the book first (idempotent) before updating it (AC12) — and
  // for a not-yet-cataloged book, that add is also what creates its catalog
  // row, so we canonicalize the URL to the real slug afterward.
  /**
   * Optimistic, and rolled back to whatever the server last said rather than to
   * a remembered value -- the same contract the library grid uses in
   * useEntryFlags, and the author page in its override.
   */
  async function handleToggleFavorite(next: boolean) {
    const real = detail?.book;
    if (!real) return;

    setFavoriteOverride(next);
    try {
      await setFavorite(real.id, next);
    } catch {
      setFavoriteOverride(null);
      toast({
        text: next
          ? `Could not favourite “${real.title}”`
          : `Could not remove “${real.title}” from favourites`,
      });
    }
  }

  async function handleRate(rating: number) {
    if (!book) return;
    const wasEphemeral = !book.cataloged;
    const real = await ensureAddedToLibrary('queued');
    await updateEntry(real.id, { userRating: rating });
    if (wasEphemeral) {
      navigate(buildBookHref({ ...book, slug: real.slug }), { replace: true });
    } else {
      reload();
    }
  }

  async function handleSaveReview(review: string) {
    if (!book) return;
    const wasEphemeral = !book.cataloged;
    const real = await ensureAddedToLibrary('queued');
    await updateEntry(real.id, { review });
    if (wasEphemeral) {
      navigate(buildBookHref({ ...book, slug: real.slug }), { replace: true });
    } else {
      reload();
    }
  }

  async function handleAddRelated(relatedBookId: number) {
    if (!book) return;
    await addRelated(book.id, relatedBookId);
    reload();
    relatedReads.reload();
  }

  async function handleRemoveRelated(relatedBookId: number) {
    if (!book) return;
    await removeRelated(book.id, relatedBookId);
    reload();
    relatedReads.reload();
  }

  async function handleAddRelatedBookToLibrary(relatedBookSlug: string) {
    await addToLibrary(relatedBookSlug, 'queued');
    relatedReads.reload();
  }

  async function handleRemoveRelatedBookFromLibrary(relatedBookId: number) {
    await removeEntry(relatedBookId);
    relatedReads.reload();
  }

  return (
    <div className={styles.page}>
      <Hero
        book={book}
        libraryEntry={libraryEntry}
        themes={themes}
        themesLoading={themesLoading}
        moods={moods}
        addingToLibrary={addingToLibrary}
        onToggleLibrary={handleToggleLibrary}
        onRemoveFromLibrary={() => setConfirmingRemove(true)}
        onStatusChange={handleStatusChange}
        onToggleFavorite={handleToggleFavorite}
        onOpenAuthor={() => navigate(`/authors/${book.authorSlug}`)}
        onThemeClick={(theme) => navigate(`/search?q=${encodeURIComponent(theme)}&theme=true`)}
        onMoodClick={(mood) =>
          navigate(`/search?q=${encodeURIComponent(`books that feel ${mood}`)}&mood=${encodeURIComponent(mood)}`)
        }
      />

      <SpecificationsCard
        book={book}
        onSubjectClick={(subject) =>
          navigate(`/search?q=${encodeURIComponent(`${subject} books`)}&subject=${encodeURIComponent(subject)}`)
        }
      />

      <div className={styles.body}>
        <div className={styles.main}>
          {visiting && (
            <>
              <h2 className={styles.sectionHeading}>
                {visitingHandle}&rsquo;s review
              </h2>
              {/* No editor at all, rather than a disabled one: there is nothing
                  here for the reader to do, and a greyed-out box would suggest
                  otherwise (LOS-360). */}
              <VisitorReview
                review={visitorEntry?.review ?? null}
                userRating={visitorEntry?.userRating ?? null}
              />
            </>
          )}
          {showOwnSections && (
            <>
              <h2 className={styles.sectionHeading}>My review</h2>
              {/* Keyed on the book, so a different book is a different box.
                  That is what lets ReviewEditor own its text outright: nothing
                  syncs the prop back into it, so a reload cannot overwrite an
                  edit in progress (LOS-353). */}
              <ReviewEditor
                key={book.id}
                userRating={libraryEntry?.userRating ?? 0}
                initialReview={libraryEntry?.review ?? ''}
                onRatingChange={handleRate}
                onSaveReview={handleSaveReview}
              />
            </>
          )}
        </div>

        <Sidebar
          authorName={book.authorName}
          authorBio={authorBio}
          works={authorWorks}
          onOpenAuthor={() => navigate(`/authors/${book.authorSlug}`)}
          onSelectBook={(selected) => navigate(buildBookHref(selected))}
        />
      </div>

      {showOwnSections && (
        <RelatedReads
          works={relatedReads.works}
          inLibrary={Boolean(libraryEntry)}
          onOpenBook={(opened) => navigate(buildBookHref(opened))}
          onAddRelated={handleAddRelated}
          onRemoveRelated={handleRemoveRelated}
          onAddToLibrary={handleAddRelatedBookToLibrary}
          onRemoveFromLibrary={handleRemoveRelatedBookFromLibrary}
        />
      )}

      {confirmingRemove && (
        <ConfirmRemoveModal
          count={1}
          title={book.title}
          onConfirm={handleRemoveFromLibrary}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </div>
  );
}
