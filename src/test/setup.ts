import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement layout, so window.scrollTo throws a "not implemented" warning.
window.scrollTo = () => {};

afterEach(() => {
  cleanup();
});
