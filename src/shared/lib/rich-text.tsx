import type { ReactNode } from 'react';
import styles from './rich-text.module.css';

/**
 * Renders a small whitelist of inline HTML / markdown found in upstream copy
 * (Google Books descriptions, author bios, AI blurbs) as real formatting:
 * bold (`<b>`/`<strong>`/`**`), italic (`<i>`/`<em>`/`*`/`_`), paragraphs
 * (`<p>`, blank lines) and line breaks (`<br>`).
 *
 * Everything is emitted as React elements/strings — never
 * `dangerouslySetInnerHTML` — so any unsupported tag or attribute payload
 * (e.g. `<script>`, `onerror=`) is stripped or rendered as inert, escaped
 * text. There is no HTML-injection surface.
 */
export interface RichTextProps {
  text: string;
  className?: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * Characters that have no printed form, replaced by a space.
 *
 * U+FFFD is the one that prompted this (LOS-355). It is what a decoder writes
 * where it found bytes it could not read, and some Google Books descriptions
 * arrive with it already in them -- "Herg\uFFFD's classic comic book creation".
 * The original letter is gone before we see it, upstream, so nothing here can
 * recover it; the choice is only what to show in its place.
 *
 * A space, not a deletion. Deleting is tidier where the lost character was a
 * letter ("Herg's") but joins two words where it was a space or a dash, and a
 * run-together sentence is harder to read past than one odd gap. It is also
 * what Google's own site does with these.
 *
 * The C0 and C1 control ranges go with it -- likewise unprintable, and likewise
 * meaningless in prose. Tab and newline are deliberately not in the set:
 * RichText reads those as structure before this runs.
 *
 * Whitespace on either side is taken with the run, so one space comes out
 * whatever went in. Without that, a character lost next to a real space --
 * "Herg\uFFFD (Georges Remi)" -- leaves two, which reads as a typo of its own.
 * Deliberately narrower than collapsing whitespace everywhere: text with
 * nothing wrong with it is not touched at all.
 */
// Control characters are the point of this pattern, not an accident in it.
// eslint-disable-next-line no-control-regex
const UNPRINTABLE = /\s*[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD\uFFFE\uFFFF]+\s*/g;

/**
 * Strips any residual/unsupported HTML tags (keeping their text content),
 * decodes entities, and drops anything with no printed form. The result is
 * placed in a React text node, so it is inert.
 *
 * Cleaned after decoding, so an entity spelling of an unprintable character
 * (`&#65533;`) is caught as well as a literal one.
 */
function toText(raw: string): string {
  return decodeEntities(raw.replace(/<[^>]*>/g, '')).replace(UNPRINTABLE, ' ');
}

// Earliest match wins: bold/italic tags (with optional attributes) and their
// markdown equivalents. Bold alternatives precede italic so `**x**` isn't read
// as two lone `*`.
const INLINE =
  /<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>|<(em|i)\b[^>]*>([\s\S]*?)<\/\3>|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([\s\S]+?)\*|_([\s\S]+?)_/i;

function parseInline(input: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = input;
  let n = 0;

  for (;;) {
    const match = INLINE.exec(rest);
    if (!match) break;

    const before = rest.slice(0, match.index);
    if (before) nodes.push(toText(before));

    const key = `${keyPrefix}-${n++}`;
    if (match[1] !== undefined) {
      nodes.push(<strong key={key}>{parseInline(match[2], key)}</strong>);
    } else if (match[3] !== undefined) {
      nodes.push(<em key={key}>{parseInline(match[4], key)}</em>);
    } else if (match[5] !== undefined) {
      nodes.push(<strong key={key}>{parseInline(match[5], key)}</strong>);
    } else if (match[6] !== undefined) {
      nodes.push(<strong key={key}>{parseInline(match[6], key)}</strong>);
    } else if (match[7] !== undefined) {
      nodes.push(<em key={key}>{parseInline(match[7], key)}</em>);
    } else {
      nodes.push(<em key={key}>{parseInline(match[8], key)}</em>);
    }

    rest = rest.slice(match.index + match[0].length);
  }

  if (rest) nodes.push(toText(rest));
  return nodes;
}

function toParagraphs(text: string): string[] {
  return text
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p\b[^>]*>/gi, '\n\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function renderParagraph(paragraph: string, keyPrefix: string): ReactNode[] {
  const lines = paragraph.split(/<br\s*\/?>|\n/i);
  const out: ReactNode[] = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push(<br key={`${keyPrefix}-br${i}`} />);
    out.push(...parseInline(line, `${keyPrefix}-l${i}`));
  });
  return out;
}

export function RichText({ text, className }: RichTextProps) {
  const paragraphs = toParagraphs(text);
  return (
    <div className={className}>
      {paragraphs.map((para, i) => (
        <p key={i} className={styles.paragraph}>
          {renderParagraph(para, `p${i}`)}
        </p>
      ))}
    </div>
  );
}
