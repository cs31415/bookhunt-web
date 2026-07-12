/** djb2 string hash, used to derive a stable pseudo-id/hue for results with no catalog identity yet. */
function djb2(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return hash >>> 0;
}

export function hashToId(seed: string): number {
  return djb2(seed);
}

export function hashToHue(seed: string): string {
  const hue = djb2(seed) % 360;
  return `hsl(${hue}, 38%, 34%)`;
}
