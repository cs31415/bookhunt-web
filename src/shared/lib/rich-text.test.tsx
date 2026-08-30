import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RichText } from './rich-text';

describe('RichText', () => {
  it('renders HTML bold/italic tags as real formatting', () => {
    const { container } = render(<RichText text="A <b>bold</b> and <i>italic</i> tale." />);
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
  });

  it('renders <strong> and <em> tags too', () => {
    const { container } = render(<RichText text="<strong>Hi</strong> <em>there</em>" />);
    expect(container.querySelector('strong')?.textContent).toBe('Hi');
    expect(container.querySelector('em')?.textContent).toBe('there');
  });

  it('renders markdown bold and italic', () => {
    const { container } = render(<RichText text="A **bold** and *italic* and _under_ tale." />);
    const strongs = Array.from(container.querySelectorAll('strong')).map((el) => el.textContent);
    const ems = Array.from(container.querySelectorAll('em')).map((el) => el.textContent);
    expect(strongs).toEqual(['bold']);
    expect(ems).toEqual(['italic', 'under']);
  });

  it('splits <p> blocks into paragraphs and <br> into line breaks', () => {
    const { container } = render(<RichText text="<p>One</p><p>Two<br>Three</p>" />);
    const paras = container.querySelectorAll('p');
    expect(paras).toHaveLength(2);
    expect(paras[0].textContent).toBe('One');
    expect(paras[1].textContent).toBe('TwoThree');
    expect(container.querySelectorAll('br')).toHaveLength(1);
  });

  it('decodes HTML entities', () => {
    render(<RichText text="Tom &amp; Jerry &mdash; &quot;fun&quot;" />);
    expect(screen.getByText('Tom & Jerry — "fun"')).toBeInTheDocument();
  });

  it('does not inject unsupported HTML — script/attribute payloads are inert', () => {
    const { container } = render(
      <RichText text={'Safe <script>alert(1)</script> <img src=x onerror="alert(2)"> text'} />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    // The tag markup is stripped, leaving only inert text content.
    expect(container.textContent).toBe('Safe alert(1)  text');
  });

  /*
   * Some Google Books descriptions arrive with U+FFFD already in them, where a
   * decoder upstream met bytes it could not read (LOS-355). The lost letter is
   * unrecoverable by the time we see it; the only question is what to show.
   */
  describe('unprintable characters', () => {
    it('shows a space where a character could not be decoded', () => {
      const { container } = render(<RichText text={"Herg\uFFFD's classic comic"} />);

      expect(container.textContent).toBe("Herg 's classic comic");
      expect(container.textContent).not.toContain('\uFFFD');
    });

    it('collapses a run of them into one space, not several', () => {
      const { container } = render(<RichText text={'a\uFFFD\uFFFD\uFFFDb'} />);

      expect(container.textContent).toBe('a b');
    });

    // A character lost beside a real space would otherwise leave two.
    it('leaves one space where the lost character sat next to one', () => {
      const { container } = render(<RichText text={'Herg\uFFFD (Georges Remi)'} />);

      expect(container.textContent).toBe('Herg (Georges Remi)');
    });

    it('drops control characters, which have no printed form either', () => {
      const { container } = render(<RichText text={'a\u0000b\u001Fc\u007Fd'} />);

      expect(container.textContent).toBe('a b c d');
    });

    // Caught after decoding, so the entity spelling is covered too.
    it('catches an entity spelling of one', () => {
      const { container } = render(<RichText text={'Herg&#65533;s'} />);

      expect(container.textContent).toBe('Herg s');
    });

    // These carry structure, and RichText reads them before this runs.
    it('leaves newlines and tabs alone', () => {
      const { container } = render(<RichText text={'one\n\ntwo'} />);

      expect(container.querySelectorAll('p')).toHaveLength(2);
    });

    it('leaves ordinary accented prose untouched', () => {
      const { container } = render(<RichText text={'Hergé wrote Tintin — café, naïve, £5'} />);

      expect(container.textContent).toBe('Hergé wrote Tintin — café, naïve, £5');
    });
  });

  it('applies the className to the wrapper', () => {
    const { container } = render(<RichText className="blurb" text="Hello" />);
    expect(container.firstElementChild).toHaveClass('blurb');
  });
});
