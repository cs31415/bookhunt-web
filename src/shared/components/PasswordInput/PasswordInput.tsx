import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import styles from './PasswordInput.module.css';

export type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * A password field the reader can read back. Masked until Show is pressed.
 *
 * The className passed in still styles the input, so each form keeps its own
 * look; this adds only the wrapper and the toggle that sits inside the border.
 *
 * The button must not sit inside a wrapping <label>: its text would join the
 * field's accessible name, which a screen reader then reads as "Password Show"
 * on every focus. Callers associate their label with htmlFor instead.
 */
export function PasswordInput({ className, ...inputProps }: PasswordInputProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <span className={styles.wrap}>
      <input {...inputProps} className={className} type={revealed ? 'text' : 'password'} />
      <button
        type="button"
        className={styles.toggle}
        // Pressed rather than a name that flips alone, so a screen reader hears
        // the state of the field and not just the next action.
        aria-pressed={revealed}
        aria-label={revealed ? 'Hide password' : 'Show password'}
        onClick={() => setRevealed((value) => !value)}
      >
        {revealed ? 'Hide' : 'Show'}
      </button>
    </span>
  );
}
