import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { updateEntry } from '../../api/library/update-entry';
import { removeEntry } from '../../api/library/remove-entry';
import { addRelated } from '../../api/library/add-related';
import { removeRelated } from '../../api/library/remove-related';
import type { LibraryStatus } from '../../shared/types/library-status';
import styles from './BookDetailPage.module.css';

export function BookDetailPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>('summary');

  const { detail, authorBio, authorWorks, relatedBooks, notFound, error, reload } = useBookDetailData(slug);
  const book = detail?.book ?? null;
  const libraryEntry = detail?.libraryEntry;

  const { summary, loading: summaryLoading, error: summaryError, regenerate } = useSummary(book?.id ?? null);
  const { themes, loading: themesLoading } = useThemes(
    book?.id ?? null,
    book?.genres ?? [],
    book?.themes ?? [],
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

  async function handleToggleLibrary() {
    if (!book) return;
    if (libraryEntry) {
      await removeEntry(book.id);
    } else {
      await addToLibrary(book.id, 'queued');
    }
    reload();
  }

  async function handleStatusChange(status: LibraryStatus) {
    if (!book) return;
    await updateEntry(book.id, { status });
    reload();
  }

  // PUT /library/:bookId 404s if the entry doesn't exist yet, so rating/notes
  // changes add the book first (idempotent) before updating it (AC12).
  async function handleRate(rating: number) {
    if (!book) return;
    await addToLibrary(book.id, 'queued');
    await updateEntry(book.id, { userRating: rating });
    reload();
  }

  async function handleSaveNotes(notes: string) {
    if (!book) return;
    await addToLibrary(book.id, 'queued');
    await updateEntry(book.id, { notes });
    reload();
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

  async function handleAddRelatedBookToLibrary(relatedBookId: number) {
    await addToLibrary(relatedBookId, 'queued');
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
        onToggleLibrary={handleToggleLibrary}
        onStatusChange={handleStatusChange}
        onRate={handleRate}
        onOpenAuthor={() => navigate(`/authors/${book.authorSlug}`)}
        onThemeClick={(theme) => navigate(`/search?q=${encodeURIComponent(theme)}&theme=true`)}
        onMoodClick={(mood) => navigate(`/search?mood=${encodeURIComponent(mood)}`)}
      />

      <SpecificationsCard
        book={book}
        onSubjectClick={(subject) => navigate(`/search?subject=${encodeURIComponent(subject)}`)}
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
