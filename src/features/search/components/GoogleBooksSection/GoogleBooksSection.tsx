export interface GoogleBooksSectionProps {
  query: string;
  catalogTitles: string[];
}

/**
 * Seam for LOS-83 (Google Books client integration). That ticket needs
 * `{ query, catalogTitles }` to fetch and dedupe external results against the
 * catalog grid above, the same way the reference prototype's `norm()`-based
 * title dedup works. Renders nothing until then.
 */
export function GoogleBooksSection(props: GoogleBooksSectionProps) {
  void props;
  return null;
}
