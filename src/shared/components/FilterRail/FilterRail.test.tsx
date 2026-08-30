import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { FilterRail } from './FilterRail';

const realMatchMedia = window.matchMedia;

/**
 * The setup stub answers false to everything. These tests turn on exactly the
 * width query the component asks about, and leave every other query alone --
 * the theme reads prefers-color-scheme through the same API.
 */
function setViewport(narrow: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: narrow && query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

describe('FilterRail', () => {
  describe('on a wide screen', () => {
    it('is a labelled aside, and nothing more', () => {
      setViewport(false);
      render(
        <FilterRail label="Library filters">
          <button type="button">Fiction</button>
        </FilterRail>,
      );

      expect(screen.getByRole('complementary', { name: 'Library filters' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Fiction' })).toBeInTheDocument();
      // A column beside the results is scenery, not a layer over the page.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Filters/ })).not.toBeInTheDocument();
    });
  });

  describe('on a narrow screen', () => {
    it('offers a trigger, and keeps the pane out of the tree until it is opened', () => {
      setViewport(true);
      render(
        <FilterRail label="Library filters">
          <button type="button">Fiction</button>
        </FilterRail>,
      );

      expect(screen.getByRole('button', { name: /Filters/ })).toBeInTheDocument();
      expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
      // Mounted so it has something to slide from, but aria-hidden until open.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens a dialog carrying the same children', async () => {
      const user = userEvent.setup();
      setViewport(true);
      render(
        <FilterRail label="Library filters">
          <button type="button">Fiction</button>
        </FilterRail>,
      );

      await user.click(screen.getByRole('button', { name: /Filters/ }));

      const dialog = screen.getByRole('dialog', { name: 'Library filters' });
      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Fiction' })).toBeInTheDocument();
    });

    it('closes on Escape and hands focus back to the trigger', async () => {
      const user = userEvent.setup();
      setViewport(true);
      render(
        <FilterRail label="Library filters">
          <button type="button">Fiction</button>
        </FilterRail>,
      );

      const trigger = screen.getByRole('button', { name: /Filters/ });
      await user.click(trigger);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    it('closes on the close button', async () => {
      const user = userEvent.setup();
      setViewport(true);
      render(
        <FilterRail label="Library filters">
          <button type="button">Fiction</button>
        </FilterRail>,
      );

      await user.click(screen.getByRole('button', { name: /Filters/ }));
      await user.click(screen.getByRole('button', { name: 'Close filters' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Choosing a filter must not dismiss the pane: a reader setting three of
    // them would otherwise have to reopen it twice.
    it('stays open when a filter inside it is used', async () => {
      const user = userEvent.setup();
      setViewport(true);
      render(
        <FilterRail label="Library filters">
          <button type="button">Fiction</button>
        </FilterRail>,
      );

      await user.click(screen.getByRole('button', { name: /Filters/ }));
      await user.click(screen.getByRole('button', { name: 'Fiction' }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('shows how many filters are set, since a folded rail cannot', () => {
      setViewport(true);
      render(
        <FilterRail label="Library filters" activeCount={3}>
          <button type="button">Fiction</button>
        </FilterRail>,
      );

      expect(screen.getByRole('button', { name: /Filters/ })).toHaveTextContent('3');
    });

    it('says nothing about a count when nothing is set', () => {
      setViewport(true);
      render(
        <FilterRail label="Library filters" activeCount={0}>
          <button type="button">Fiction</button>
        </FilterRail>,
      );

      expect(screen.getByRole('button', { name: /Filters/ })).toHaveTextContent(/^Filters$/);
    });

    it('locks the page behind it while open, and lets go afterwards', async () => {
      const user = userEvent.setup();
      setViewport(true);
      render(
        <FilterRail label="Library filters">
          <button type="button">Fiction</button>
        </FilterRail>,
      );

      expect(document.body.style.overflow).not.toBe('hidden');

      await user.click(screen.getByRole('button', { name: /Filters/ }));
      expect(document.body.style.overflow).toBe('hidden');

      await user.keyboard('{Escape}');
      expect(document.body.style.overflow).not.toBe('hidden');
    });
  });
});
