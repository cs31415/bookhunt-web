import { useCallback, useEffect, useState } from 'react';

export interface UseLibrarySelectionResult {
  selecting: boolean;
  selectedIds: Set<number>;
  enter: () => void;
  exit: () => void;
  toggle: (bookId: number) => void;
  selectAll: (bookIds: number[]) => void;
  clear: () => void;
}

/**
 * Multi-select state for the library grid.
 *
 * Selection and selection *mode* are separate: leaving the mode clears the set,
 * but clearing the set does not leave the mode — a reader who unticks their last
 * book is still choosing, and yanking the checkboxes away mid-task would be a
 * surprise.
 */
export function useLibrarySelection(): UseLibrarySelectionResult {
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const exit = useCallback(() => {
    setSelecting(false);
    setSelectedIds(new Set());
  }, []);

  // Escape is the way out of every other transient state on this page — the
  // card menu, the modals — so it is the way out of this one too.
  useEffect(() => {
    if (!selecting) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') exit();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selecting, exit]);

  const toggle = useCallback((bookId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  }, []);

  return {
    selecting,
    selectedIds,
    enter: useCallback(() => setSelecting(true), []),
    exit,
    toggle,
    selectAll: useCallback((bookIds: number[]) => setSelectedIds(new Set(bookIds)), []),
    clear: useCallback(() => setSelectedIds(new Set()), []),
  };
}
