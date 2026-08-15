import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  isThemeChoice,
  readStoredChoice,
  resolveTheme,
  storeChoice,
  systemTheme,
  THEME_STORAGE_KEY,
} from './theme';

function stubSystem(prefersDark: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: prefersDark,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  stubSystem(false);
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  localStorage.clear();
});

describe('readStoredChoice', () => {
  it('follows the system until the reader picks something', () => {
    expect(readStoredChoice()).toBe('system');
  });

  it('reads back what was stored', () => {
    storeChoice('dark');
    expect(readStoredChoice()).toBe('dark');
  });

  it('ignores a value that is not a choice', () => {
    // The key is shared with an inline script in index.html and is plain text
    // in localStorage, so anything at all can be sitting there.
    localStorage.setItem(THEME_STORAGE_KEY, 'chartreuse');
    expect(readStoredChoice()).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('takes an explicit choice at its word', () => {
    stubSystem(true);
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('asks the system only for the system choice', () => {
    stubSystem(true);
    expect(resolveTheme('system')).toBe('dark');
    stubSystem(false);
    expect(resolveTheme('system')).toBe('light');
  });
});

describe('applyTheme', () => {
  it('stamps the resolved theme on the document', () => {
    expect(applyTheme('dark')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('writes light explicitly rather than removing the attribute', () => {
    // tokens.css has a prefers-color-scheme block, so choosing Light on a
    // dark-mode machine has to override it, not merely stop adding to it.
    stubSystem(true);
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

describe('isThemeChoice', () => {
  it('accepts the three real choices and nothing else', () => {
    expect(['light', 'dark', 'system'].every(isThemeChoice)).toBe(true);
    expect(isThemeChoice('auto')).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });
});

describe('when localStorage is unavailable', () => {
  it('falls back to the system rather than throwing', () => {
    // Private browsing can refuse it outright, and a theme is not worth failing
    // a page load over.
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(readStoredChoice()).toBe('system');
    expect(() => storeChoice('dark')).not.toThrow();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe('systemTheme', () => {
  it('reports what the machine is set to', () => {
    stubSystem(true);
    expect(systemTheme()).toBe('dark');
  });
});
