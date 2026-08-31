import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewEditor } from './ReviewEditor';

function renderReview(props: Partial<Parameters<typeof ReviewEditor>[0]> = {}) {
  const onSaveReview = vi.fn().mockResolvedValue(undefined);
  render(
    <ReviewEditor
      userRating={0}
      initialReview=""
      onRatingChange={vi.fn()}
      onSaveReview={onSaveReview}
      {...props}
    />,
  );
  return {
    onSaveReview: (props.onSaveReview ?? onSaveReview) as ReturnType<typeof vi.fn>,
    box: () => screen.getByRole('textbox'),
    saveButton: () => screen.getByRole('button', { name: /Save/ }),
    /** Everything below the reading view happens behind this (LOS-369). */
    openEditor: () => fireEvent.click(screen.getByRole('button', { name: /Edit|Write a review/ })),
  };
}

describe('ReviewEditor', () => {
  /*
   * A finished review is something to read, not a draft sitting in a field. It
   * was a textarea at all times before, which made a review from months ago
   * look unfinished and set it in the field face rather than the prose one
   * (LOS-369).
   */
  describe('reading', () => {
    it('shows a written review as prose, with nothing to type into', () => {
      renderReview({ initialReview: 'A patient book, and worth the patience.' });

      expect(screen.getByText('A patient book, and worth the patience.')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('offers Edit when there is a review to change', () => {
      renderReview({ initialReview: 'Notes from last month' });

      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    // "Edit" over an empty space asks the reader to edit nothing.
    it('asks for a first review when there is none', () => {
      renderReview();

      expect(screen.getByRole('button', { name: 'Write a review' })).toBeInTheDocument();
      expect(screen.getByText(/have not reviewed this book yet/)).toBeInTheDocument();
    });

    /*
     * Rating is one click and saves on its own. Putting it behind the editor
     * would make a reader open a writing tool to do a filing job.
     */
    it('keeps the rating live without opening the editor', () => {
      const onRatingChange = vi.fn();
      renderReview({ initialReview: 'A review', onRatingChange });

      fireEvent.click(screen.getByTestId('star-4'));

      expect(onRatingChange).toHaveBeenCalledWith(4);
    });
  });

  describe('editing', () => {
    it('opens with the review that was there', () => {
      const { openEditor, box } = renderReview({ initialReview: 'Notes from last month' });

      openEditor();

      expect(box()).toHaveValue('Notes from last month');
    });

    it('counts what is in the box', () => {
      const { openEditor } = renderReview({ initialReview: 'Four' });

      openEditor();

      expect(screen.getByText(/4 chars/)).toBeInTheDocument();
    });

    /*
     * The point of the button. Saving used to be debounced on every keystroke,
     * and the save reloads the page -- which scrolled to the top and handed the
     * text back as the server had it, so the caret jumped and anything typed
     * since the last debounce was lost (LOS-353).
     */
    it('writes nothing while the reader is typing', async () => {
      const { openEditor, box, onSaveReview } = renderReview();

      openEditor();
      fireEvent.change(box(), { target: { value: 'A note' } });
      fireEvent.change(box(), { target: { value: 'A note, still going' } });
      await new Promise((resolve) => setTimeout(resolve, 700));

      expect(onSaveReview).not.toHaveBeenCalled();
    });

    it('offers nothing to save until the text is changed', () => {
      const { openEditor, saveButton } = renderReview({ initialReview: 'Notes from last month' });

      openEditor();

      expect(saveButton()).toBeDisabled();
    });

    it('activates once the text is changed', () => {
      const { openEditor, box, saveButton } = renderReview();

      openEditor();
      fireEvent.change(box(), { target: { value: 'A note' } });

      expect(saveButton()).toBeEnabled();
    });

    // Typing back to where it started is not a change, so there is nothing to
    // write and the button says so.
    it('goes quiet again when the text is put back as it was', () => {
      const { openEditor, box, saveButton } = renderReview({ initialReview: 'Original' });

      openEditor();
      fireEvent.change(box(), { target: { value: 'Edited' } });
      expect(saveButton()).toBeEnabled();

      fireEvent.change(box(), { target: { value: 'Original' } });
      expect(saveButton()).toBeDisabled();
    });

    it('writes what is in the box when pressed', async () => {
      const { openEditor, box, saveButton, onSaveReview } = renderReview();

      openEditor();
      fireEvent.change(box(), { target: { value: 'A note' } });
      fireEvent.click(saveButton());

      await waitFor(() => expect(onSaveReview).toHaveBeenCalledWith('A note'));
    });

    /*
     * The confirmation. The review comes back as prose with the new words in
     * it, which says the save landed better than the word "saved" did -- and is
     * why that word is gone from here.
     */
    it('returns to the review, rewritten, once the write has landed', async () => {
      const { openEditor, box, saveButton } = renderReview({ initialReview: 'Short.' });

      openEditor();
      fireEvent.change(box(), { target: { value: 'Longer, on reflection.' } });
      fireEvent.click(saveButton());

      await waitFor(() => expect(screen.getByText('Longer, on reflection.')).toBeInTheDocument());
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    it('sends no second request while the first is in flight', async () => {
      let release: () => void = () => {};
      const onSaveReview = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      );
      const { openEditor, box, saveButton } = renderReview({ onSaveReview });

      openEditor();
      fireEvent.change(box(), { target: { value: 'A note' } });
      fireEvent.click(saveButton());

      await waitFor(() => expect(onSaveReview).toHaveBeenCalled());
      expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();

      release();
      await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
      expect(onSaveReview).toHaveBeenCalledTimes(1);
    });

    // Closing the box on a failed write would hide the words the reader just
    // lost. It stays open, with the text in it and Save still there.
    it('keeps the box open when the write fails', async () => {
      const onSaveReview = vi.fn().mockRejectedValue(new Error('offline'));
      const { openEditor, box, saveButton } = renderReview({ onSaveReview });

      openEditor();
      fireEvent.change(box(), { target: { value: 'A note' } });
      fireEvent.click(saveButton());

      await waitFor(() => expect(onSaveReview).toHaveBeenCalled());
      expect(box()).toHaveValue('A note');
      await waitFor(() => expect(saveButton()).toBeEnabled());
    });

    // Leaving discards outright rather than half-keeping: an edit the reader
    // backed out of should not be waiting for them the next time they open it.
    it('throws away the edit on Cancel', () => {
      const { openEditor, box } = renderReview({ initialReview: 'Original' });

      openEditor();
      fireEvent.change(box(), { target: { value: 'Half a thought' } });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByText('Original')).toBeInTheDocument();

      openEditor();
      expect(box()).toHaveValue('Original');
    });

    // Emptying the box is a real save, and lands back on the first-review ask.
    it('takes a review away when the box is emptied', async () => {
      const { openEditor, box, saveButton, onSaveReview } = renderReview({ initialReview: 'A note' });

      openEditor();
      fireEvent.change(box(), { target: { value: '' } });
      fireEvent.click(saveButton());

      await waitFor(() => expect(onSaveReview).toHaveBeenCalledWith(''));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Write a review' })).toBeInTheDocument(),
      );
    });

    // The hint that used to sit here said saving a note adds the book to the
    // library. The behaviour stays; the sentence does not (LOS-352).
    it('offers no explanation of what saving does', () => {
      const { openEditor } = renderReview();

      openEditor();

      expect(screen.queryByText(/adds this book to your library/)).not.toBeInTheDocument();
    });
  });
});
