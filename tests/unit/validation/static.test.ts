import { describe, expect, it } from 'vitest';
import { validateStatic } from '../../../src/validation/static.js';
import type { DocumentAnalysis } from '../../../src/types.js';

function createDocument(overrides: Partial<DocumentAnalysis> = {}): DocumentAnalysis {
  return {
    absolutePath: '/virtual/doc.md',
    relativePath: 'doc.md',
    anchors: [],
    references: [],
    definitions: [],
    usages: [],
    unresolvedReferences: [],
    ...overrides,
  };
}

describe('validateStatic', () => {
  it('reports a reference without a definition as an error', () => {
    const document = createDocument({
      unresolvedReferences: [{ id: 'nope', isImage: false, position: { line: 4, column: 3 } }],
    });

    expect(validateStatic(document)).toEqual([
      {
        code: 'UNDEFINED_REFERENCE',
        severity: 'error',
        relativePath: 'doc.md',
        position: { line: 4, column: 3 },
        message: 'reference "nope" is used but never defined',
        reference: '[nope]',
      },
    ]);
  });

  it('marks image references in the report', () => {
    const document = createDocument({
      unresolvedReferences: [{ id: 'gone', isImage: true, position: { line: 1, column: 1 } }],
    });

    expect(validateStatic(document)[0]).toMatchObject({
      code: 'UNDEFINED_REFERENCE',
      reference: '![gone]',
    });
  });

  it('reports definitions that nothing uses as warnings', () => {
    const document = createDocument({
      definitions: [
        { id: 'unused', destination: 'https://example.com', position: { line: 9, column: 1 } },
      ],
    });

    expect(validateStatic(document)).toEqual([
      {
        code: 'UNUSED_DEFINITION',
        severity: 'warning',
        relativePath: 'doc.md',
        position: { line: 9, column: 1 },
        message: 'definition "unused" is never used',
        reference: '[unused]',
      },
    ]);
  });

  it('accepts a used definition referenced once', () => {
    const document = createDocument({
      definitions: [
        { id: 'api', destination: 'https://example.com', position: { line: 9, column: 1 } },
      ],
      usages: [{ id: 'api', isImage: false, position: { line: 2, column: 5 } }],
    });

    expect(validateStatic(document)).toEqual([]);
  });
});
