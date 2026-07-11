/** Estimates reading time from page count (~1.4 min/page ≈ 275 wpm). */
export function readTime(pages: number | null): string | null {
  if (!pages) return null;
  const mins = Math.round(pages * 1.4);
  if (mins < 60) return `${mins} min`;
  const hours = mins / 60;
  return mins % 60 === 0 ? `${Math.floor(hours)} hr` : `${hours.toFixed(1)} hr`;
}
