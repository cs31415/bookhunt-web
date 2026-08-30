import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiActivityIndicator } from './ApiActivityIndicator';
import { beginRequest, endRequest } from '../../../api/api-activity';

// Both thresholds live in use-activity-visibility; these mirror them.
const APPEAR_AFTER_MS = 250;
const STAY_FOR_MS = 400;

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('ApiActivityIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('renders nothing when no requests are in flight', () => {
    render(<ApiActivityIndicator />);
    advance(APPEAR_AFTER_MS);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  // The point of the delay: most requests land inside it, and the reader who
  // would have seen a flash now sees nothing at all.
  it('stays hidden for a request that finishes inside the delay', () => {
    render(<ApiActivityIndicator />);

    act(() => beginRequest());
    advance(APPEAR_AFTER_MS - 50);
    act(() => endRequest());
    advance(APPEAR_AFTER_MS);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('appears once a request outlives the delay', () => {
    render(<ApiActivityIndicator />);

    act(() => beginRequest());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    advance(APPEAR_AFTER_MS);
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => endRequest());
  });

  // Once up it is a state, not a blink: it holds even if the request lands
  // immediately afterwards.
  it('holds for the minimum once it has appeared', () => {
    render(<ApiActivityIndicator />);

    act(() => beginRequest());
    advance(APPEAR_AFTER_MS);
    act(() => endRequest());

    advance(STAY_FOR_MS - 50);
    expect(screen.getByRole('status')).toBeInTheDocument();

    advance(50);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('goes away promptly when the request ran longer than the minimum', () => {
    render(<ApiActivityIndicator />);

    act(() => beginRequest());
    advance(APPEAR_AFTER_MS + STAY_FOR_MS + 100);
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => endRequest());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('stays up while overlapping requests keep the app busy', () => {
    render(<ApiActivityIndicator />);

    act(() => beginRequest());
    act(() => beginRequest());
    advance(APPEAR_AFTER_MS);
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => endRequest());
    advance(STAY_FOR_MS + 100);
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => endRequest());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders nothing at all when the indicator is switched off', () => {
    vi.stubEnv('VITE_SHOW_ACTIVITY_SPINNER', 'false');
    render(<ApiActivityIndicator />);

    act(() => beginRequest());
    advance(APPEAR_AFTER_MS + 100);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => endRequest());
  });
});
