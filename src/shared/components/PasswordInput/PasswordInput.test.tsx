import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordInput } from './PasswordInput';

function renderField() {
  render(
    <>
      <label htmlFor="pw">Password</label>
      <PasswordInput id="pw" name="password" defaultValue="b00kW0rm!" />
    </>,
  );
  return screen.getByLabelText('Password');
}

describe('PasswordInput', () => {
  it('reveals and re-masks the password', () => {
    const input = renderField();
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('reports the state of the field, not just the next action', () => {
    renderField();
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('keeps the toggle out of the field name', () => {
    // getByLabelText is exact by default, so a leaked "Show" would fail here.
    expect(renderField()).toHaveAccessibleName('Password');
  });
});
