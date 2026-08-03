import { useState } from 'react';
import { Modal } from '../Modal/Modal';
import modal from '../Modal/Modal.module.css';
import styles from './ConfirmRemoveModal.module.css';

export interface ConfirmRemoveModalProps {
  /** Named when removing one book; the count carries it when removing several. */
  title?: string;
  count: number;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

/**
 * Asks before a removal, and says what the removal costs.
 *
 * Removal deletes the library entry, and the entry is where the reader's own
 * work lives — the status, the rating, the review, the notes. The books
 * themselves are shared catalog rows and stay put, which is worth saying too:
 * without it, "remove" reads like it might delete the book for everyone.
 */
export function ConfirmRemoveModal({ title, count, onConfirm, onCancel }: ConfirmRemoveModalProps) {
  const [removing, setRemoving] = useState(false);

  const subject = count === 1 && title ? `“${title}”` : `${count} books`;

  async function handleConfirm() {
    setRemoving(true);
    try {
      await onConfirm();
    } finally {
      // The parent unmounts this on success, so this only matters on failure —
      // where leaving the button spinning forever would strand the reader.
      setRemoving(false);
    }
  }

  return (
    <Modal
      eyebrow="Remove"
      title={count === 1 ? 'Remove this book?' : `Remove ${count} books?`}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className={modal.btn} onClick={onCancel} disabled={removing}>
            Cancel
          </button>
          <button
            type="button"
            className={`${modal.btn} ${modal.btnPrimary}`}
            onClick={handleConfirm}
            disabled={removing}
          >
            {removing ? 'Removing…' : 'Remove'}
          </button>
        </>
      }
    >
      <p className={styles.body}>
        {subject} will be taken out of your library, along with any rating, review and notes. That
        cannot be undone.
      </p>
    </Modal>
  );
}
