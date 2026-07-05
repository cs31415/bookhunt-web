import { useState } from 'react';
import { BookCard } from '../../shared/components/BookCard/BookCard';
import { BookRow } from '../../shared/components/BookRow/BookRow';
import { Cover } from '../../shared/components/Cover/Cover';
import { PieChart } from '../../shared/components/PieChart/PieChart';
import { SearchBar } from '../../shared/components/SearchBar/SearchBar';
import { ActionMenu } from '../../shared/components/ActionMenu/ActionMenu';
import { SectionHead } from '../../shared/components/SectionHead/SectionHead';
import { Stars } from '../../shared/components/Stars/Stars';
import { StatusBadge } from '../../shared/components/StatusBadge/StatusBadge';
import { ALL_LIBRARY_STATUSES } from '../../shared/types/library-status';
import type { LibraryStatus } from '../../shared/types/library-status';
import {
  bookWithCoverImage,
  bookWithLongTitle,
  bookWithNoCover,
  gallerySlices,
  googleBooksBook,
  unratedBook,
} from './sample-data';

export function ComponentGallery() {
  const [searchValue, setSearchValue] = useState('');
  const [interactiveRating, setInteractiveRating] = useState(0);
  const [actionMenuStatus, setActionMenuStatus] = useState<LibraryStatus>('reading');
  const [lastPick, setLastPick] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1>Component Gallery (dev only)</h1>

      <section style={{ marginBottom: 40 }}>
        <SectionHead title="Cover" />
        <div style={{ display: 'flex', gap: 24 }}>
          <Cover book={bookWithCoverImage} size="md" />
          <Cover book={bookWithNoCover} size="md" />
          <Cover book={bookWithLongTitle} size="md" />
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHead title="Stars" />
        <p>Display mode, value 3.5:</p>
        <Stars value={3.5} mode="display" />
        <p>Interactive mode (hover + click to set rating: {interactiveRating}):</p>
        <Stars value={interactiveRating} mode="interactive" onChange={setInteractiveRating} />
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHead title="StatusBadge" />
        <div style={{ display: 'flex', gap: 12 }}>
          {ALL_LIBRARY_STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHead title="BookCard" />
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <BookCard book={bookWithCoverImage} status="reading" />
          <BookCard book={unratedBook} />
          <BookCard book={googleBooksBook} />
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHead title="BookRow" />
        <div style={{ maxWidth: 400 }}>
          <BookRow book={bookWithCoverImage} status="finished" />
          <BookRow book={bookWithNoCover} />
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHead title="PieChart" />
        <PieChart slices={gallerySlices} onPick={(slice) => setLastPick(slice.label)} />
        <p>Last picked slice: {lastPick ?? 'none'}</p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHead title="SearchBar" />
        <SearchBar value={searchValue} onChange={setSearchValue} />
        <p>Value: {searchValue}</p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHead title="ActionMenu" />
        <ActionMenu current={actionMenuStatus} onSelect={setActionMenuStatus} />
      </section>
    </div>
  );
}
