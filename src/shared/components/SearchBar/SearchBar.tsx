import { useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import styles from './SearchBar.module.css';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  big?: boolean;
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search by idea, title, author, mood…',
  big = false,
  autoFocus = false,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        onChange={(event) => onChange(event.target.value)}
        aria-label="Search"
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
    </form>
  );
}
