/**
 * Hands the browser a JSON file to save.
 *
 * A Blob and an object URL rather than a `data:` URI: a library of a few
 * hundred books runs to hundreds of kilobytes, and browsers cap how long a URL
 * may be. The anchor is created, clicked and dropped in one go, and the object
 * URL is revoked afterwards so the Blob does not sit in memory for the life of
 * the page.
 *
 * Its own function so the page that calls it can be tested without asserting on
 * anchors and object URLs.
 */
export function downloadJson(filename: string, data: unknown): void {
  // Indented: the file is something a reader may open and read, not only feed
  // back to the importer.
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  // Firefox ignores a click on an anchor that is not in the document.
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

/** Dated, so a reader keeping several backups can tell them apart. */
export function exportFilename(now: Date = new Date()): string {
  return `bookhunt-library-${now.toISOString().slice(0, 10)}.json`;
}
