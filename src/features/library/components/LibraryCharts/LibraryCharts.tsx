import { PieChart } from '../../../../shared/components/PieChart/PieChart';
import type { PieSlice } from '../../../../shared/components/PieChart/PieChart';
import {
  ALL_LIBRARY_STATUSES,
  LIBRARY_STATUS_LABELS,
} from '../../../../shared/types/library-status';
import type { LibraryStatus } from '../../../../shared/types/library-status';
import type { LibraryEntry } from '../../../../normalize/library';
import {
  OTHER_SLICE_LABEL,
  authorSlices,
  moodSlices,
  statusSlices,
  subjectSlices,
} from '../../lib/breakdowns';
import styles from './LibraryCharts.module.css';

const STATUS_BY_LABEL = new Map<string, LibraryStatus>(
  ALL_LIBRARY_STATUSES.map((status) => [LIBRARY_STATUS_LABELS[status], status]),
);

const CHART_SIZE = 148;

export interface LibraryChartsProps {
  entries: LibraryEntry[];
  onSelectStatus: (status: LibraryStatus) => void;
  onSelectSubject: (subject: string) => void;
  onSelectAuthor: (author: string) => void;
  onSelectMood: (mood: string) => void;
}

function Chart({
  title,
  slices,
  onPick,
}: {
  title: string;
  slices: PieSlice[];
  onPick: (slice: PieSlice) => void;
}) {
  return (
    <div className={styles.chart}>
      <div className={styles.chartTitle}>{title}</div>
      <PieChart slices={slices} size={CHART_SIZE} onPick={onPick} />
    </div>
  );
}

export function LibraryCharts({
  entries,
  onSelectStatus,
  onSelectSubject,
  onSelectAuthor,
  onSelectMood,
}: LibraryChartsProps) {
  // Moods are AI-generated and filled in lazily, so a library where nothing has
  // been tagged yet gets no chart rather than an empty circle.
  const moods = moodSlices(entries);
  return (
    <section className={styles.charts} aria-label="Library breakdown">
      <Chart
        title="By Status"
        slices={statusSlices(entries)}
        onPick={(slice) => {
          const status = STATUS_BY_LABEL.get(slice.label);
          if (status) onSelectStatus(status);
        }}
      />
      <Chart
        title="By Subject"
        slices={subjectSlices(entries)}
        onPick={(slice) => {
          // The collapsed "Other" bucket isn't a single filterable value.
          if (slice.label !== OTHER_SLICE_LABEL) onSelectSubject(slice.label);
        }}
      />
      <Chart
        title="By Author"
        slices={authorSlices(entries)}
        onPick={(slice) => {
          if (slice.label !== OTHER_SLICE_LABEL) onSelectAuthor(slice.label);
        }}
      />
      {moods.length > 0 && (
        <Chart
          title="By Mood"
          slices={moods}
          onPick={(slice) => {
            if (slice.label !== OTHER_SLICE_LABEL) onSelectMood(slice.label);
          }}
        />
      )}
    </section>
  );
}
