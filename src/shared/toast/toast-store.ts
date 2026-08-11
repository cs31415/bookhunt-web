/**
 * Minimal toast store, shaped after src/api/api-activity.ts: a module-level
 * listener Set plus a stable snapshot for useSyncExternalStore. Exists because
 * background work can finish after the modal that started it is closed, and
 * needs somewhere to surface.
 */

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  text: string;
  action?: ToastAction;
}

export const TOAST_DURATION_MS = 8000;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Returns the same array reference until something changes, so
// useSyncExternalStore doesn't loop.
export function getToasts(): Toast[] {
  return toasts;
}

export function toast(input: { text: string; action?: ToastAction }): number {
  const id = nextId++;
  toasts = [...toasts, { id, ...input }];
  timers.set(
    id,
    setTimeout(() => dismiss(id), TOAST_DURATION_MS),
  );
  emit();
  return id;
}

export function dismiss(id: number): void {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  const next = toasts.filter((t) => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

/** Test-only reset; keeps timers from leaking between cases. */
export function clearToasts(): void {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  toasts = [];
  emit();
}
