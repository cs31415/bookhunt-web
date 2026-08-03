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
import { CoverFold } from '../../shared/components/CoverFold/CoverFold';
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
        <SectionHead eyebrow="Design system" title="Cover" />
        <div style={{ display: 'flex', gap: 24 }}>
          <Cover book={bookWithCoverImage} width={132} />
          <Cover book={bookWithNoCover} width={132} />
          <Cover book={bookWithLongTitle} width={132} />
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
        <SectionHead title="CoverFold" />
        {/* Over three very different covers, which is the point of it: the flap
            is paper-coloured so it separates from artwork we cannot inspect. */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {ALL_LIBRARY_STATUSES.map((status) => (
            <div key={status} style={{ width: 92 }}>
              <div style={{ position: 'relative', borderRadius: '3px 5px 5px 3px' }}>
                <div
                  style={{
                    height: 132,
                    borderRadius: '3px 5px 5px 3px',
                    background: status === 'reading' ? '#1f3a63' : status === 'finished' ? '#101010' : '#e9e4d8',
                  }}
                />
                <CoverFold status={status} />
              </div>
              <div style={{ fontSize: 12, marginTop: 6, color: 'var(--muted)' }}>{status}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHead title="BookCard" />
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ width: 132 }}>
            <BookCard book={bookWithCoverImage} status="reading" reason="More from Herbert" />
          </div>
          <div style={{ width: 132 }}>
            <BookCard book={unratedBook} />
          </div>
          <div style={{ width: 132 }}>
            <BookCard book={googleBooksBook} />
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <SectionHead title="BookRow" />
        <div style={{ maxWidth: 400 }}>
          <BookRow book={bookWithCoverImage} status="finished" />
          <BookRow book={bookWithNoCover} reason="Because you read evolution" />
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
