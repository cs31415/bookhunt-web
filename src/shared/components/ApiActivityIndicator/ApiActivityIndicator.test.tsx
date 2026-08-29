import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiActivityIndicator } from './ApiActivityIndicator';
import { beginRequest, endRequest } from '../../../api/api-activity';

describe('ApiActivityIndicator', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders nothing when no requests are in flight', () => {
    render(<ApiActivityIndicator />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the loader while a request is in flight and hides it once it ends', async () => {
    render(<ApiActivityIndicator />);

    beginRequest();
    expect(await screen.findByRole('status')).toBeInTheDocument();

    endRequest();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('stays visible while multiple overlapping requests are in flight', async () => {
    render(<ApiActivityIndicator />);

    beginRequest();
    beginRequest();
    expect(await screen.findByRole('status')).toBeInTheDocument();

    endRequest();
    expect(screen.getByRole('status')).toBeInTheDocument();

    endRequest();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  // The request starts before the render, so the first paint already sees a
  // non-zero count. A waitFor on an absence would pass before React had
  // flushed anything, and so would pass with the switch ignored.
  it('renders nothing at all when the spinner is switched off', () => {
    vi.stubEnv('VITE_SHOW_ACTIVITY_SPINNER', 'false');
    beginRequest();
    try {
      render(<ApiActivityIndicator />);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally {
      endRequest();
    }
  });

  // Same shape as the test above, which is what makes the pair meaningful:
  // one value hides it, the other does not, from an identical starting state.
  it('stays on for any other value of the switch', () => {
    vi.stubEnv('VITE_SHOW_ACTIVITY_SPINNER', 'true');
    beginRequest();
    try {
      render(<ApiActivityIndicator />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    } finally {
      endRequest();
    }
  });
});
