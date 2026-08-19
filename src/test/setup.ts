import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement layout, so window.scrollTo throws a "not implemented" warning.
window.scrollTo = () => {};

// Same reason, and jsdom leaves this one undefined entirely: Collapsible calls
// it when collapsing scrolls a panel back into view (LOS-293).
Element.prototype.scrollIntoView = () => {};

// jsdom has no matchMedia at all, and the theme reads prefers-color-scheme
// (LOS-258). Defaults to light; a test that cares overrides this stub.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

afterEach(() => {
  cleanup();
});
