let activeCount = 0;
const listeners = new Set<() => void>();

export function beginRequest(): void {
  activeCount += 1;
  listeners.forEach((listener) => listener());
}

export function endRequest(): void {
  activeCount -= 1;
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActiveRequestCount(): number {
  return activeCount;
}
