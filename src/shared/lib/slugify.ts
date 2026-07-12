/** Mirrors the backend's slug generation (title/author name -> URL-safe slug). */
export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'book'
  );
}
