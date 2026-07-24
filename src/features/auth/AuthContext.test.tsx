import { act, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { postLogin } from '../../api/auth/login';

vi.mock('../../api/auth/login');

const mockedPostLogin = vi.mocked(postLogin);

const user = { id: 7, email: 'reader@example.com', displayName: 'Ada Reader' };

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  localStorage.clear();
  mockedPostLogin.mockReset();
});

afterEach(() => {
  localStorage.clear();
});

describe('useAuth', () => {
  it('starts logged out when there is no stored session', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('logs in: stores token + user and flips to authenticated', async () => {
    mockedPostLogin.mockResolvedValue({ user, token: 'jwt-123' });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('reader@example.com', 'b00kW0rm!');
    });

    expect(mockedPostLogin).toHaveBeenCalledWith({
      email: 'reader@example.com',
      password: 'b00kW0rm!',
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(user);
    expect(localStorage.getItem('bookhunt_token')).toBe('jwt-123');
    expect(JSON.parse(localStorage.getItem('bookhunt_user')!)).toEqual(user);
  });

  it('logout clears the stored session', async () => {
    mockedPostLogin.mockResolvedValue({ user, token: 'jwt-123' });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('reader@example.com', 'b00kW0rm!');
    });
    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('bookhunt_token')).toBeNull();
    expect(localStorage.getItem('bookhunt_user')).toBeNull();
  });

  it('hydrates from a stored session on mount', () => {
    localStorage.setItem('bookhunt_token', 'jwt-123');
    localStorage.setItem('bookhunt_user', JSON.stringify(user));
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(user);
  });

  it('throws when used outside an AuthProvider', () => {
    function Probe() {
      useAuth();
      return null;
    }
    // Silence the expected React error boundary logging for this render.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useAuth must be used within an AuthProvider');
    spy.mockRestore();
  });
});
