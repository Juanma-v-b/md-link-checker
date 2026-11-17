import { describe, expect, it } from 'vitest';
import { DEFAULT_IGNORES, isIgnoredPath, normalizePath } from '../../../src/discovery/ignore.js';

describe('isIgnoredPath', () => {
  it('matches a rule without a slash against any segment', () => {
    expect(isIgnoredPath('node_modules/pkg/README.md', ['node_modules'])).toBe(true);
    expect(isIgnoredPath('packages/app/node_modules/x.md', DEFAULT_IGNORES)).toBe(true);
    expect(isIgnoredPath('dist/bundle.md', DEFAULT_IGNORES)).toBe(true);
  });

  it('does not match partial segments', () => {
    expect(isIgnoredPath('node_modules2/x.md', ['node_modules'])).toBe(false);
    expect(isIgnoredPath('distribution/x.md', ['dist'])).toBe(false);
  });

  it('matches a rule with a slash against a path prefix', () => {
    expect(isIgnoredPath('docs/drafts/a.md', ['docs/drafts'])).toBe(true);
    expect(isIgnoredPath('docs/drafts', ['docs/drafts'])).toBe(true);
    expect(isIgnoredPath('docs/drafts2/a.md', ['docs/drafts'])).toBe(false);
    expect(isIgnoredPath('other/docs/drafts/a.md', ['docs/drafts'])).toBe(false);
  });

  it('accepts Windows separators and trailing slashes in rules', () => {
    expect(isIgnoredPath('docs\\drafts\\a.md', ['docs/drafts/'])).toBe(true);
    expect(isIgnoredPath('./docs/drafts/a.md', ['docs/drafts'])).toBe(true);
  });

  it('returns false for an empty path or empty rules', () => {
    expect(isIgnoredPath('', ['docs'])).toBe(false);
    expect(isIgnoredPath('docs/a.md', [])).toBe(false);
    expect(isIgnoredPath('docs/a.md', [''])).toBe(false);
  });
});

describe('normalizePath', () => {
  it('collapses separators and removes leading and trailing slashes', () => {
    expect(normalizePath('\\docs\\\\nested\\a.md')).toBe('docs/nested/a.md');
    expect(normalizePath('/docs/')).toBe('docs');
    expect(normalizePath('./docs')).toBe('docs');
  });
});
