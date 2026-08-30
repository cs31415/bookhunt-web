import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  return {
    onSaveNotes: (props.onSaveNotes ?? onSaveNotes) as ReturnType<typeof vi.fn>,
    box: () => screen.getByRole('textbox'),
    saveButton: () => screen.getByRole('button', { name: /Save/ }),
  };
}

describe('NotesTab', () => {
  it('counts what is in the box', () => {
    renderNotes({ initialNotes: 'Four' });

    expect(screen.getByText(/4 chars/)).toBeInTheDocument();
  });

  /*
   * The point of the button. Saving used to be debounced on every keystroke,
   * and the save reloads the page -- which scrolled to the top and handed the
   * text back as the server had it, so the caret jumped and anything typed
   * since the last debounce was lost (LOS-353).
   */
  it('writes nothing while the reader is typing', async () => {
    const { box, onSaveNotes } = renderNotes();

    fireEvent.change(box(), { target: { value: 'A note' } });
    fireEvent.change(box(), { target: { value: 'A note, still going' } });
    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(onSaveNotes).not.toHaveBeenCalled();
  });

  it('offers nothing to save until the text is changed', () => {
    const { saveButton } = renderNotes({ initialNotes: 'Notes from last month' });

    expect(saveButton()).toBeDisabled();
  });

  it('activates once the text is changed', () => {
    const { box, saveButton } = renderNotes();

    fireEvent.change(box(), { target: { value: 'A note' } });

    expect(saveButton()).toBeEnabled();
  });

  // Typing back to where it started is not a change, so there is nothing to
  // write and the button says so.
  it('goes quiet again when the text is put back as it was', () => {
    const { box, saveButton } = renderNotes({ initialNotes: 'Original' });

    fireEvent.change(box(), { target: { value: 'Edited' } });
    expect(saveButton()).toBeEnabled();

    fireEvent.change(box(), { target: { value: 'Original' } });
    expect(saveButton()).toBeDisabled();
  });

  it('writes what is in the box when pressed', async () => {
    const { box, saveButton, onSaveNotes } = renderNotes();

    fireEvent.change(box(), { target: { value: 'A note' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(onSaveNotes).toHaveBeenCalledWith('A note'));
  });

  it('says so once the write has landed, and not before', async () => {
    let release: () => void = () => {};
    const onSaveNotes = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { box, saveButton } = renderNotes({ onSaveNotes });

    fireEvent.change(box(), { target: { value: 'A note' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(onSaveNotes).toHaveBeenCalled());
    expect(screen.queryByText(/saved/)).not.toBeInTheDocument();
    // No second request while the first is in flight.
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();

    release();
    expect(await screen.findByText(/· saved/)).toBeInTheDocument();
  });

  it('claims nothing when the write fails, and leaves Save available', async () => {
    const onSaveNotes = vi.fn().mockRejectedValue(new Error('offline'));
    const { box, saveButton } = renderNotes({ onSaveNotes });

    fireEvent.change(box(), { target: { value: 'A note' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(onSaveNotes).toHaveBeenCalled());
    expect(screen.queryByText(/saved/)).not.toBeInTheDocument();
    // The note is still in the box, and the reader can try again.
    expect(box()).toHaveValue('A note');
    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it('takes the word back as soon as the note is edited again', async () => {
    const { box, saveButton } = renderNotes();

    fireEvent.change(box(), { target: { value: 'A note' } });
    fireEvent.click(saveButton());
    expect(await screen.findByText(/· saved/)).toBeInTheDocument();

    fireEvent.change(box(), { target: { value: 'A note, extended' } });

    expect(screen.queryByText(/saved/)).not.toBeInTheDocument();
  });

  // Emptying the box is a real save, but there is then nothing to report on.
  it('says nothing once the box has been emptied', async () => {
    const { box, saveButton } = renderNotes({ initialNotes: 'A note' });

    fireEvent.change(box(), { target: { value: '' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText(/0 chars/)).toBeInTheDocument());
    expect(screen.queryByText(/saved/)).not.toBeInTheDocument();
  });

  // Notes that arrived already saved are not an act to report on.
  it('says nothing about saving before anything is done', () => {
    renderNotes({ initialNotes: 'Notes from last month' });

    expect(screen.queryByText(/saved/)).not.toBeInTheDocument();
  });

  // The hint that used to sit here said saving a note adds the book to the
  // library. The behaviour stays; the sentence does not (LOS-352).
  it('offers no explanation of what saving does', () => {
    renderNotes();

    expect(screen.queryByText(/adds this book to your library/)).not.toBeInTheDocument();
  });
});
