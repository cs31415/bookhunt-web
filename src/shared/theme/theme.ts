/**
 * The reader's theme choice, and how it becomes a `data-theme` on <html>.
 *
 * Three values, not two. 'system' is a real choice -- it means "keep following
 * the OS" -- and collapsing it to whichever mode the OS happens to be in right
 * now would freeze the reader to today's answer.
 *
 * Kept free of React so the no-flash script in index.html can use the same key
 * and the same rules. That script runs before the bundle and is the only reason
 * a cold load in dark mode does not paint white first.
 */
export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Shared with the inline script in index.html. Changing it means changing both. */
export const THEME_STORAGE_KEY = 'bookhunt_theme';

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readStoredChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(raw) ? raw : 'system';
  } catch {
    // Private browsing can refuse localStorage outright. Following the OS is a
    // sound answer, and a theme is not worth failing a page load over.
    return 'system';
  }
}

export function storeChoice(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // As above: the choice will not survive the reload, which beats throwing.
  }
}

export function systemTheme(): ResolvedTheme {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  return choice === 'system' ? systemTheme() : choice;
}

/**
 * Stamps the resolved theme on <html>. tokens.css carries a
 * :root[data-theme='light'] block as well as a dark one, so an explicit choice
 * wins in both directions -- picking Light on a dark-mode machine has to
 * actually override the prefers-color-scheme block, not merely fail to add to
 * it.
 */
export function applyTheme(choice: ThemeChoice): ResolvedTheme {
  const resolved = resolveTheme(choice);
  document.documentElement.setAttribute('data-theme', resolved);
  return resolved;
}
