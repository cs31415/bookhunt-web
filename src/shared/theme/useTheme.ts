import { useCallback, useEffect, useState } from 'react';
import {
  applyTheme,
  readStoredChoice,
  resolveTheme,
  storeChoice,
} from './theme';
import type { ResolvedTheme, ThemeChoice } from './theme';

export interface Theme {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (choice: ThemeChoice) => void;
}

/**
 * Owns the theme for the running app.
 *
 * Hydrates from localStorage rather than from the signed-in reader, because the
 * inline script in index.html has already painted from that same value and the
 * two must agree. AppShell adopts the server's preference afterwards, which is
 * what carries a choice to a second browser.
 *
 * While the choice is 'system' the OS is followed live: a reader who flips
 * their machine to dark at dusk should not have to reload.
 */
export function useTheme(): Theme {
  const [choice, setChoiceState] = useState<ThemeChoice>(() => readStoredChoice());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(choice));

  const setChoice = useCallback((next: ThemeChoice) => {
    storeChoice(next);
    setChoiceState(next);
    setResolved(applyTheme(next));
  }, []);

  // Applies to the DOM only. `resolved` is already correct: the initial state
  // computed it from the same choice, and setChoice updates both together.
  useEffect(() => {
    applyTheme(choice);
  }, [choice]);

  useEffect(() => {
    if (choice !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(applyTheme('system'));
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [choice]);

  return { choice, resolved, setChoice };
}
