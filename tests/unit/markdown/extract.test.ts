import { describe, expect, it } from 'vitest';
import { extractDocument } from '../../../src/markdown/extract.js';
import type { DocumentAnalysis } from '../../../src/types.js';

function extract(source: string, relativePath = 'doc.md'): DocumentAnalysis {
  return extractDocument({
    source,
    absolutePath: `/virtual/${relativePath}`,
    relativePath,
  });
}

describe('extractDocument', () => {
  it('extracts inline links and images with their position', () => {
    const document = extract('# Title\n\nText [a](https://a.com) and ![img](pic.png).\n');

    expect(document.references).toEqual([
      { type: 'link', destination: 'https://a.com', label: 'a', position: { line: 3, column: 6 } },
      { type: 'image', destination: 'pic.png', label: 'img', position: { line: 3, column: 29 } },
    ]);
    expect(document.relativePath).toBe('doc.md');
  });

  it('extracts autolinks and GFM autolink literals', () => {
    const document = extract('<https://a.com>\n\nhttps://b.com\n\nwww.c.com\n');

    expect(document.references.map((reference) => reference.destination)).toEqual([
      'https://a.com',
      'https://b.com',
      'http://www.c.com',
    ]);
  });

  it('builds anchors from headings, including duplicates', () => {
    const document = extract('# Hello World\n\n## Hello World\n');

    expect(document.anchors).toEqual(['hello-world', 'hello-world-1']);
  });

  it('reads headings with inline formatting and code', () => {
    const document = extract('## A *fancy* `heading`\n');

    expect(document.anchors).toEqual(['a-fancy-heading']);
  });

  it('links definitions with their usages', () => {
    const document = extract(
      [
        '# Doc',
        '',
        'See [the docs][docs], [another][] and [shortcut].',
        '',
        '[docs]: https://example.com/docs',
        '[another]: ./another.md',
        '[shortcut]: #doc',
        '',
      ].join('\n'),
    );

    expect(document.definitions.map((definition) => definition.id)).toEqual([
      'docs',
      'another',
      'shortcut',
    ]);
    expect(document.usages.map((usage) => usage.id)).toEqual(['docs', 'another', 'shortcut']);
    expect(document.unresolvedReferences).toEqual([]);
    expect(document.references).toHaveLength(3);
    expect(document.references.every((reference) => reference.type === 'definition')).toBe(true);
  });

  it('detects explicit references without a definition', () => {
    const document = extract('# Doc\n\n[missing][nope] and ![image][gone]\n\n[defined]: https://example.com\n');

    expect(document.unresolvedReferences).toEqual([
      { id: 'nope', isImage: false, position: { line: 3, column: 1 } },
      { id: 'gone', isImage: true, position: { line: 3, column: 21 } },
    ]);
  });

  it('detects collapsed references without a definition', () => {
    const document = extract('[orphan][]\n');

    expect(document.unresolvedReferences.map((usage) => usage.id)).toEqual(['orphan']);
  });

  it('ignores links inside inline code and fenced blocks', () => {
    const source = [
      '# Doc',
      '',
      'Inline `[a](https://a.com)` and `[x][nope]`.',
      '',
      '```md',
      '[b](https://b.com)',
      '[y][nope]',
      '```',
      '',
    ].join('\n');

    const document = extract(source);

    expect(document.references).toEqual([]);
    expect(document.unresolvedReferences).toEqual([]);
  });

  it('ignores escaped brackets', () => {
    const document = extract('\\[x\\]\\[y\\]\n');

    expect(document.references).toEqual([]);
    expect(document.unresolvedReferences).toEqual([]);
  });

  it('extracts links from GFM tables', () => {
    const document = extract('| A | B |\n| - | - |\n| [x](https://x.com) | `code` |\n');

    expect(document.references.map((reference) => reference.destination)).toEqual([
      'https://x.com',
    ]);
  });

  it('ignores raw HTML links', () => {
    const document = extract('<a href="https://example.com">text</a>\n');

    expect(document.references).toEqual([]);
  });

  it('returns empty collections for a document without references', () => {
    const document = extract('# Just a title\n\nSome text.\n');

    expect(document).toMatchObject({
      anchors: ['just-a-title'],
      references: [],
      definitions: [],
      usages: [],
      unresolvedReferences: [],
    });
  });

  it('normalises labels when matching definitions', () => {
    const document = extract('[text][Some   Label]\n\n[some label]: https://example.com\n');

    expect(document.unresolvedReferences).toEqual([]);
    expect(document.usages.map((usage) => usage.id)).toEqual(['some label']);
  });
});
