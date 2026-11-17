import { describe, expect, it } from 'vitest';
import { createHeadingSlugger, normalizeAnchor } from '../../../src/markdown/slug.js';

describe('createHeadingSlugger', () => {
  it('slugifies heading text like GitHub', () => {
    const slug = createHeadingSlugger();

    expect(slug('Hello World')).toBe('hello-world');
    expect(slug('Installation & setup')).toBe('installation--setup');
    expect(slug('What\u2019s new?')).toBe('whats-new');
    expect(slug('Año nuevo')).toBe('año-nuevo');
  });

  it('disambiguates repeated headings', () => {
    const slug = createHeadingSlugger();

    expect([slug('Usage'), slug('Usage'), slug('Usage')]).toEqual([
      'usage',
      'usage-1',
      'usage-2',
    ]);
  });

  it('keeps separate instances independent', () => {
    const first = createHeadingSlugger();
    const second = createHeadingSlugger();

    first('Usage');

    expect(second('Usage')).toBe('usage');
  });
});

describe('normalizeAnchor', () => {
  it('lowercases and trims fragments', () => {
    expect(normalizeAnchor('  Getting-Started ')).toBe('getting-started');
  });
});
