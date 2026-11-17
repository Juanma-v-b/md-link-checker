import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyReference } from '../../../src/references/classify.js';
import type { DocumentAnalysis, RawReference } from '../../../src/types.js';

const document: DocumentAnalysis = {
  absolutePath: path.resolve('/work/docs/guide.md'),
  relativePath: 'docs/guide.md',
  anchors: [],
  references: [],
  definitions: [],
  usages: [],
  unresolvedReferences: [],
};

function classify(
  destination: string,
  type: RawReference['type'] = 'link',
): ReturnType<typeof classifyReference> {
  return classifyReference(document, {
    type,
    destination,
    label: null,
    position: { line: 1, column: 1 },
  });
}

function resolveRelative(target: string): string {
  return path.resolve(path.dirname(document.absolutePath), target);
}

describe('classifyReference', () => {
  it('classifies http and https URLs as external', () => {
    expect(classify('https://example.com/docs')).toMatchObject({
      kind: 'external-http',
      href: 'https://example.com/docs',
      anchor: null,
      resolvedPath: null,
    });
    expect(classify('HTTP://example.com').kind).toBe('external-http');
  });

  it('classifies protocol-relative URLs as external', () => {
    expect(classify('//cdn.example.com/file.js').kind).toBe('external-http');
  });

  it('keeps the fragment of an external URL', () => {
    expect(classify('https://example.com/page#section')).toMatchObject({
      kind: 'external-http',
      href: 'https://example.com/page',
      anchor: 'section',
    });
  });

  it('ignores mailto, tel and other schemes', () => {
    expect(classify('mailto:hello@example.com').kind).toBe('other');
    expect(classify('tel:+34123456789').kind).toBe('other');
    expect(classify('file:///etc/hosts').kind).toBe('other');
  });

  it('classifies same-document anchors', () => {
    expect(classify('#getting-started')).toMatchObject({
      kind: 'same-document-anchor',
      href: '',
      anchor: 'getting-started',
    });
  });

  it('ignores an empty destination and a bare hash', () => {
    expect(classify('').kind).toBe('other');
    expect(classify('#').kind).toBe('other');
  });

  it('classifies local files and resolves them against the document', () => {
    const result = classify('./other.md');

    expect(result.kind).toBe('local-file');
    expect(result.resolvedPath).toBe(resolveRelative('other.md'));
  });

  it('classifies local images', () => {
    const result = classify('../img/logo.png', 'image');

    expect(result.kind).toBe('local-image');
    expect(result.resolvedPath).toBe(resolveRelative('../img/logo.png'));
  });

  it('decodes percent-encoded local paths', () => {
    const result = classify('my%20file.md');

    expect(result.resolvedPath).toBe(resolveRelative('my file.md'));
  });

  it('normalises backslashes in local paths', () => {
    const result = classify('docs\\nested\\file.md');

    expect(result.kind).toBe('local-file');
    expect(result.resolvedPath).toBe(resolveRelative('docs/nested/file.md'));
  });

  it('ignores query strings when resolving local files', () => {
    const result = classify('page.md?raw=1');

    expect(result.kind).toBe('local-file');
    expect(result.resolvedPath).toBe(resolveRelative('page.md'));
  });

  it('classifies file links with anchors as cross-document', () => {
    const result = classify('../README.md#project-a');

    expect(result).toMatchObject({
      kind: 'cross-document-anchor',
      href: '../README.md',
      anchor: 'project-a',
      resolvedPath: resolveRelative('../README.md'),
    });
  });

  it('lowercases anchors so comparisons are case-insensitive', () => {
    expect(classify('guide.md#Getting-Started').anchor).toBe('getting-started');
  });

  it('decodes percent-encoded anchors', () => {
    expect(classify('#a%C3%B1o').anchor).toBe('año');
  });

  it('ignores root-relative paths, which depend on the site root', () => {
    expect(classify('/docs/guide.md').kind).toBe('other');
  });
});
