import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

/*
 * How long findBy* and waitFor poll before giving up, up from the 1000ms
 * default (LOS-332).
 *
 * Worth being clear about what this does and does not do. It did NOT fix the
 * HandleSearch flake: raising the budget there just moved the ceiling, and the
 * file failed at 4000ms as readily as at 1000ms, because that budget was being
 * measured against a fake clock that raced with machine load. That file drives
 * its clock explicitly now and polls for nothing.
 *
 * What this is for is the waits that are honestly slow under load -- real
 * timers, a real socket, a page rendering sixty covers. For those the budget is
 * denominated in real time, so a bigger one genuinely buys more attempts.
 *
 * It hides nothing either way: a wait that never resolves still fails on the
 * test timeout in vitest.config.ts.
 */
configure({ asyncUtilTimeout: 4000 });

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
