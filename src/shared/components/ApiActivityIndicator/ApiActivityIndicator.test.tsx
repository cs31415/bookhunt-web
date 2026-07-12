import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiActivityIndicator } from './ApiActivityIndicator';
import { beginRequest, endRequest } from '../../../api/api-activity';

describe('ApiActivityIndicator', () => {
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
});
