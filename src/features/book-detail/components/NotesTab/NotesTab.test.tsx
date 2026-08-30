import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotesTab } from './NotesTab';

function renderNotes(props: Partial<Parameters<typeof NotesTab>[0]> = {}) {
  const onSaveNotes = vi.fn().mockResolvedValue(undefined);
  render(
    <NotesTab
      userRating={0}
      initialNotes=""
      onRatingChange={vi.fn()}
      onSaveNotes={onSaveNotes}
      {...props}
    />,
  );
  return { onSaveNotes, box: () => screen.getByRole('textbox') };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('NotesTab', () => {
  it('counts what is in the box', () => {
    renderNotes({ initialNotes: 'Four' });

    expect(screen.getByText(/4 chars/)).toBeInTheDocument();
  });

  // The word is feedback on an act of typing. A reader opening a book they
  // annotated last month is not owed a report on it.
  it('says nothing about saving before anything is typed', () => {
    renderNotes({ initialNotes: 'Notes from last month' });

    expect(screen.queryByText(/saved/)).not.toBeInTheDocument();
  });

  it('says nothing while the debounce is still running', () => {
    const { box } = renderNotes();

    fireEvent.change(box(), { target: { value: 'A note' } });

    expect(screen.queryByText(/saved/)).not.toBeInTheDocument();
  });

  it('says so once the write has landed', async () => {
    const { box, onSaveNotes } = renderNotes();

    fireEvent.change(box(), { target: { value: 'A note' } });
    await vi.advanceTimersByTimeAsync(600);

    expect(onSaveNotes).toHaveBeenCalledWith('A note');
    expect(await screen.findByText(/· saved/)).toBeInTheDocument();
  });

  // "saved" has to mean the write landed, not that one was started, or it is
  // just a word that is always there.
  it('waits for the write, not merely for the debounce', async () => {
    let release: () => void = () => {};
    const onSaveNotes = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    renderNotes({ onSaveNotes });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A note' } });
    await vi.advanceTimersByTimeAsync(600);

    expect(onSaveNotes).toHaveBeenCalled();
    expect(screen.queryByText(/saved/)).not.toBeInTheDocument();

    release();
    expect(await screen.findByText(/· saved/)).toBeInTheDocument();
  });

  it('claims nothing when the write fails', async () => {
    const onSaveNotes = vi.fn().mockRejectedValue(new Error('offline'));
    renderNotes({ onSaveNotes });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'A note' } });
    await vi.advanceTimersByTimeAsync(600);

    await waitFor(() => expect(onSaveNotes).toHaveBeenCalled());
    expect(screen.queryByText(/saved/)).not.toBeInTheDocument();
  });

  it('takes the word back as soon as the note is edited again', async () => {
    const { box } = renderNotes();

    fireEvent.change(box(), { target: { value: 'A note' } });
    await vi.advanceTimersByTimeAsync(600);
    expect(await screen.findByText(/· saved/)).toBeInTheDocument();

    fireEvent.change(box(), { target: { value: 'A note, extended' } });

    expect(screen.queryByText(/saved/)).not.toBeInTheDocument();
  });

  // Emptying the box is a real save, but there is then nothing to report on.
  it('says nothing once the box has been emptied', async () => {
    const { box } = renderNotes();

    fireEvent.change(box(), { target: { value: 'A note' } });
    await vi.advanceTimersByTimeAsync(600);
    expect(await screen.findByText(/· saved/)).toBeInTheDocument();

    fireEvent.change(box(), { target: { value: '' } });
    await vi.advanceTimersByTimeAsync(600);

    expect(screen.queryByText(/saved/)).not.toBeInTheDocument();
    expect(screen.getByText(/0 chars/)).toBeInTheDocument();
  });

  // The hint that used to sit here said saving a note adds the book to the
  // library. The behaviour stays; the sentence does not (LOS-352).
  it('offers no explanation of what saving does', () => {
    renderNotes();

    expect(screen.queryByText(/adds this book to your library/)).not.toBeInTheDocument();
  });
});
