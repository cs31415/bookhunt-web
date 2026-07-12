import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Hero } from './components/Hero/Hero';
import { SpecificationsCard } from './components/SpecificationsCard/SpecificationsCard';
import { Tabs } from './components/Tabs/Tabs';
import type { TabId } from './components/Tabs/Tabs';
import { SummaryTab } from './components/SummaryTab/SummaryTab';
import { NotesTab } from './components/NotesTab/NotesTab';
import { Sidebar } from './components/Sidebar/Sidebar';
import { RelatedReads } from './components/RelatedReads/RelatedReads';
import { useBookDetailData } from './hooks/useBookDetailData';
import { useSummary } from './hooks/useSummary';
import { useThemes } from './hooks/useThemes';
import { useRelatedReads } from './hooks/useRelatedReads';
import { addToLibrary } from '../../api/library/add-to-library';
import type { AddToLibraryRawFields } from '../../api/library/add-to-library';
import { updateEntry } from '../../api/library/update-entry';
import { removeEntry } from '../../api/library/remove-entry';
import { addRelated } from '../../api/library/add-related';
import { removeRelated } from '../../api/library/remove-related';
import type { BookDetail } from '../../normalize/book-detail';
import type { LibraryStatus } from '../../shared/types/library-status';
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
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('summary');

  const { detail, authorBio, authorWorks, relatedBooks, notFound, error, reload } = useBookDetailData(
    slug,
    authorSlug,
  );
  const book = detail?.book ?? null;
  const libraryEntry = detail?.libraryEntry;

  const { summary, loading: summaryLoading, error: summaryError, regenerate } = useSummary(
    book?.cataloged ? book.id : null,
    book?.cataloged ?? true,
    book?.blurb ?? '',
  );
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
  // typing in Notes doesn't flash the whole page on every debounced save.
  if (!book) {
    return <div className={styles.page} />;
  }

  // Ensures the book has a real catalog row before an action that needs one
  // (rating, notes, toggling into the library) — the only place a
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
    const wasEphemeral = !book.cataloged;
    const real = await ensureAddedToLibrary('queued');
    if (wasEphemeral) {
      navigate(`/books/${real.slug}`, { replace: true });
    } else {
      reload();
    }
  }

  async function handleStatusChange(status: LibraryStatus) {
    if (!book) return;
    await updateEntry(book.id, { status });
    reload();
  }

  // PUT /library/:bookId 404s if the entry doesn't exist yet, so rating/notes
  // changes add the book first (idempotent) before updating it (AC12) — and
  // for a not-yet-cataloged book, that add is also what creates its catalog
  // row, so we canonicalize the URL to the real slug afterward.
  async function handleRate(rating: number) {
    if (!book) return;
    const wasEphemeral = !book.cataloged;
    const real = await ensureAddedToLibrary('queued');
    await updateEntry(real.id, { userRating: rating });
    if (wasEphemeral) {
      navigate(`/books/${real.slug}`, { replace: true });
    } else {
      reload();
    }
  }

  async function handleSaveNotes(notes: string) {
    if (!book) return;
    const wasEphemeral = !book.cataloged;
    const real = await ensureAddedToLibrary('queued');
    await updateEntry(real.id, { notes });
    if (wasEphemeral) {
      navigate(`/books/${real.slug}`, { replace: true });
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
        onToggleLibrary={handleToggleLibrary}
        onStatusChange={handleStatusChange}
        onRate={handleRate}
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

      <Tabs active={tab} hasNote={Boolean(libraryEntry?.notes)} onChange={setTab} />

      <div className={styles.body}>
        <div className={styles.main}>
          {tab === 'summary' && (
            <SummaryTab
              loading={summaryLoading}
              error={summaryError}
              summary={summary}
              blurb={book.blurb}
              onRegenerate={regenerate}
            />
          )}
          {tab === 'notes' && (
            <NotesTab
              userRating={libraryEntry?.userRating ?? 0}
              initialNotes={libraryEntry?.notes ?? ''}
              inLibrary={Boolean(libraryEntry)}
              onRatingChange={handleRate}
              onSaveNotes={handleSaveNotes}
            />
          )}
        </div>

        <Sidebar
          authorName={book.authorName}
          authorBio={authorBio}
          works={authorWorks}
          onOpenAuthor={() => navigate(`/authors/${book.authorSlug}`)}
          onSelectBook={(bookSlug) => navigate(`/books/${bookSlug}`)}
        />
      </div>

      <RelatedReads
        works={relatedReads.works}
        inLibrary={Boolean(libraryEntry)}
        onOpenBook={(bookSlug) => navigate(`/books/${bookSlug}`)}
        onAddRelated={handleAddRelated}
        onRemoveRelated={handleRemoveRelated}
        onAddToLibrary={handleAddRelatedBookToLibrary}
        onRemoveFromLibrary={handleRemoveRelatedBookFromLibrary}
      />
    </div>
  );
}
