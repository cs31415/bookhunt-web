import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { clearToasts, dismiss, getToasts, subscribe, toast, TOAST_DURATION_MS } from './toast-store';

describe('toast-store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearToasts();
  });

  afterEach(() => {
    clearToasts();
    vi.useRealTimers();
  });

  it('adds a toast and notifies subscribers', () => {
    const listener = vi.fn();
    subscribe(listener);

    toast({ text: 'Found 3 books from your photos' });

    expect(listener).toHaveBeenCalled();
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0].text).toBe('Found 3 books from your photos');
  });

  it('keeps the snapshot reference stable between changes', () => {
    toast({ text: 'one' });
    expect(getToasts()).toBe(getToasts());
  });

  it('retains an action so the caller can reopen the modal', () => {
    const onClick = vi.fn();
    toast({ text: 'Found 2 books', action: { label: 'Review', onClick } });

    getToasts()[0].action!.onClick();
    expect(onClick).toHaveBeenCalled();
  });

  it('auto-expires after the toast duration', () => {
    toast({ text: 'gone soon' });
    expect(getToasts()).toHaveLength(1);

    vi.advanceTimersByTime(TOAST_DURATION_MS);
    expect(getToasts()).toHaveLength(0);
  });

  it('dismisses on demand and cancels the pending timer', () => {
    const id = toast({ text: 'manual' });
    dismiss(id);
    expect(getToasts()).toHaveLength(0);

    const listener = vi.fn();
    subscribe(listener);
    vi.advanceTimersByTime(TOAST_DURATION_MS);
    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores a dismiss for an unknown id', () => {
    toast({ text: 'still here' });
    dismiss(9999);
    expect(getToasts()).toHaveLength(1);
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    unsubscribe();

    toast({ text: 'unheard' });
    expect(listener).not.toHaveBeenCalled();
  });
});
