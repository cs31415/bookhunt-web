import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTheme } from './useTheme';
import { isThemeChoice } from './theme';
import type { ResolvedTheme, ThemeChoice } from './theme';
import { useAuth } from '../../features/auth/AuthContext';
import { updateMe } from '../../api/users/update-me';

export interface ThemeContextValue {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (choice: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Ties the local theme to the signed-in reader's stored preference.
 *
 * localStorage is the source of truth for the first paint -- the inline script
 * in index.html has already used it, and disagreeing with that would reintroduce
 * the flash it exists to prevent. The server value is what carries a choice to
 * a second browser, so it is adopted once, when a session appears.
 *
 * Must sit inside AuthProvider.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { user, updateUser } = useAuth();
  const { setChoice: setLocalChoice } = theme;

  // Adopted once per reader. Without this a reader who picks Dark here, then
  // signs in on a machine set to Light, has their choice overwritten on every
  // render rather than being able to change it.
  const adoptedFor = useRef<number | null>(null);
  const storedChoice = user?.preferences?.theme;

  useEffect(() => {
    if (!user) {
      adoptedFor.current = null;
      return;
    }
    if (adoptedFor.current === user.id) return;
    adoptedFor.current = user.id;
    if (isThemeChoice(storedChoice)) setLocalChoice(storedChoice);
  }, [user, storedChoice, setLocalChoice]);

  const setChoice = useCallback(
    (next: ThemeChoice) => {
      setLocalChoice(next);
      if (!user) return;

      // Fired and not awaited: the theme has already changed on screen, and a
      // failed save is not worth an error message about a setting the reader
      // can see is applied. It costs them the choice on another browser.
      updateMe({ preferences: { theme: next } })
        .then(({ user: updated }) => updateUser({ preferences: updated.preferences }))
        .catch(() => {});
    },
    [setLocalChoice, user, updateUser],
  );

  return (
    <ThemeContext.Provider value={{ ...theme, setChoice }}>{children}</ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its provider is idiomatic; only affects HMR granularity
export function useThemeChoice(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useThemeChoice must be used inside ThemeProvider');
  return value;
}
