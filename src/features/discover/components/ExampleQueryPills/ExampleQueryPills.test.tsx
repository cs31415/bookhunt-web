import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExampleQueryPills } from './ExampleQueryPills';

describe('ExampleQueryPills', () => {
  it('renders a pill per query and fires onPick with its text when clicked', () => {
    const onPick = vi.fn();
    render(
      <ExampleQueryPills queries={['history that reads like a thriller', 'cozy mysteries']} onPick={onPick} />,
    );

    fireEvent.click(screen.getByText('cozy mysteries'));
    expect(onPick).toHaveBeenCalledWith('cozy mysteries');
  });
});
