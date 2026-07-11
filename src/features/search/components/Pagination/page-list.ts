export type PageListItem = number | '…';

/**
 * Builds the numbered-pill list for pagination, collapsing long ranges with an
 * ellipsis: [1, …, current-1, current, current+1, …, total] once total > 7.
 */
export function pageList(current: number, total: number): PageListItem[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const out: PageListItem[] = [1];
  if (current > 3) out.push('…');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    out.push(i);
  }
  if (current < total - 2) out.push('…');
  out.push(total);
  return out;
}
