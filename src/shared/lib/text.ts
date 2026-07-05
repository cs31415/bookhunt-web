export function getSurname(authorName: string): string {
  const parts = authorName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export function wrapTitle(title: string, maxCharsPerLine: number): string[] {
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  return lines;
}

export function pickFontSize(lineCount: number, longestLineLen: number): number {
  if (lineCount > 3 || longestLineLen > 16) return 11;
  if (lineCount > 2 || longestLineLen > 12) return 14;
  if (lineCount > 1) return 18;
  return 22;
}
