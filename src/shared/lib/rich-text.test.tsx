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

  it('applies the className to the wrapper', () => {
    const { container } = render(<RichText className="blurb" text="Hello" />);
    expect(container.firstElementChild).toHaveClass('blurb');
  });
});
