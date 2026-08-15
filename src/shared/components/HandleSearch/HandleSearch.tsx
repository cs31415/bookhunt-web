import { useEffect, useId, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDismissOnOutside } from '../../layout/use-dismiss-on-outside';
import { useHandleResults } from './useHandleResults';
import styles from './HandleSearch.module.css';

export interface HandleSearchProps {
  /** The text after the leading @. */
  query: string;
  /** The input this dropdown belongs to. Key handling attaches to it directly. */
  inputRef: RefObject<HTMLInputElement | null>;
  /** Closes the mode — used when the reader picks someone or presses Escape. */
  onDismiss: () => void;
}

/**
 * The reader picker that appears when a search begins with @.
 *
 * Built rather than reused: the nearest thing in the codebase is RelatedPicker,
 * which is a panel with no anchored dropdown, no arrow-key navigation and no
 * ARIA roles. All three are required here.
 *
 * Every piece of combobox behaviour lives in this one component, including the
 * key handling — which is why it takes the input's ref and listens on the
 * element rather than on its own wrapper. The wrapper is a sibling of the
 * input, so events from the caret would never reach it, and splitting the
 * logic across two components to work around that is how the arrow keys and
 * the highlight drift apart later.
 *
 * Focus never moves to the list: the active option is pointed at with
 * aria-activedescendant, so the caret stays where the reader is typing.
 */
export function HandleSearch({ query, inputRef, onDismiss }: HandleSearchProps) {
  const navigate = useNavigate();
  const users = useHandleResults(query);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useDismissOnOutside(true, containerRef, onDismiss);

  // Clamped rather than reset: the list shrinks as the reader types, and an
  // index left past the end would point at nothing.
  const active = Math.min(activeIndex, Math.max(users.length - 1, 0));

  // Held in a ref so the listener below can read the current results without
  // being torn down and rebuilt on every keystroke. Written in an effect, not
  // during render: a render can be thrown away under concurrent rendering.
  const stateRef = useRef({ users, active });
  useEffect(() => {
    stateRef.current = { users, active };
  }, [users, active]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    function onKeyDown(event: KeyboardEvent) {
      const { users: current, active: index } = stateRef.current;
      if (current.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % current.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + current.length) % current.length);
      } else if (event.key === 'Enter') {
        // Taken from the form, which would otherwise submit a book search for
        // a string beginning with @.
        event.preventDefault();
        onDismiss();
        navigate(`/${current[index].handle}`);
      }
    }

    input.addEventListener('keydown', onKeyDown);
    return () => input.removeEventListener('keydown', onKeyDown);
  }, [inputRef, navigate, onDismiss]);

  // Set on the element rather than passed as a prop: the id belongs to this
  // component, and the input belongs to SearchBar.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const id = users.length > 0 ? `${listId}-${active}` : '';
    if (id) input.setAttribute('aria-activedescendant', id);
    else input.removeAttribute('aria-activedescendant');
    return () => input.removeAttribute('aria-activedescendant');
  }, [inputRef, listId, active, users.length]);

  function choose(handle: string) {
    onDismiss();
    navigate(`/${handle}`);
  }

  return (
    <div className={styles.wrap} ref={containerRef}>
      <div className={styles.panel} role="listbox" id={listId} aria-label="Readers">
        {users.length === 0 ? (
          <p className={styles.empty}>
            {query.trim().length === 0 ? 'Type a handle to find a reader.' : 'No readers found.'}
          </p>
        ) : (
          users.map((user, index) => (
            <button
              key={user.handle}
              type="button"
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? `${styles.option} ${styles.active}` : styles.option}
              // Pointer-down rather than click: the outside-dismiss listener
              // also runs on pointer-down and would close the panel first.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(user.handle);
              }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className={styles.handle}>@{user.handle}</span>
              <span className={styles.name}>{user.displayName}</span>
              <span className={styles.count}>{user.bookCount}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
