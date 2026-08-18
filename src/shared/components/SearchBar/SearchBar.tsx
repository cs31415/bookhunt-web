import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { HandleSearch } from '../HandleSearch/HandleSearch';
import styles from './SearchBar.module.css';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  big?: boolean;
  autoFocus?: boolean;
  /**
   * Turns on reader lookup when the query starts with @. Off by default, so
   * the library's filter box and any other in-place search are unaffected
   * (LOS-260).
   */
  people?: boolean;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  // Names the @ gesture where it is read at the moment of use. Reader lookup is
  // otherwise invisible: the only other mention of handles is inside the
  // dropdown, which nobody sees until they have already typed one. Callers that
  // pass their own placeholder and turn `people` on say it themselves.
  placeholder = 'Search by idea, title, author, mood… or @handle',
  big = false,
  autoFocus = false,
  people = false,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [dismissed, setDismissed] = useState(false);

  // The mode is the text, not a toggle: deleting the @ returns to book search
  // with the query intact, and nothing has to be reset.
  const peopleMode = people && value.startsWith('@') && !dismissed;
  const handleQuery = peopleMode ? value.slice(1) : '';

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // In people mode Enter picks a reader; submitting would run a book search
    // for a string beginning with @, which is never what was meant.
    if (peopleMode) return;
    onSubmit?.(value);
  }

  return (
    <form
      className={big ? `${styles.wrap} ${styles.big}` : styles.wrap}
      onSubmit={handleSubmit}
    >
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <line
          x1="15.5"
          y1="15.5"
          x2="21"
          y2="21"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <input
        ref={inputRef}
        className={styles.input}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          // Re-arms the panel, so dismissing it once does not stop it coming
          // back when the reader keeps typing a handle.
          setDismissed(false);
          onChange(event.target.value);
        }}
        aria-label="Search"
        /*
         * Only while the dropdown is actually open. A combobox role on an
         * input that has no list attached is a promise to assistive tech that
         * nothing keeps -- in book mode this is a plain text box and should
         * say so.
         */
        {...(peopleMode && {
          role: 'combobox',
          'aria-expanded': true,
          'aria-controls': listId,
          'aria-autocomplete': 'list' as const,
        })}
        /*
         * Labels the on-screen keyboard's return key "Search". Load-bearing on
         * narrow screens, where the submit button is hidden and that key is the
         * only way to run the search. A form with a single text input submits on
         * Enter regardless, and the button stays in the DOM (hidden, not removed)
         * so implicit submission is never in question.
         */
        enterKeyHint="search"
      />
      {big && (
        <button type="submit" className={styles.submit}>
          Search
        </button>
      )}
      {peopleMode && (
        <HandleSearch
          query={handleQuery}
          inputRef={inputRef}
          onDismiss={() => setDismissed(true)}
        />
      )}
    </form>
  );
}
