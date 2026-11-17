import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyzeProject } from '../../src/analyze.js';
import { buildCheckResult } from '../../src/report/summary.js';

const fixture = fileURLToPath(new URL('../fixtures/project-a', import.meta.url));

describe('analyzeProject', () => {
  it('analyses every Markdown document of a project', async () => {
    const analysis = await analyzeProject(['.'], { cwd: fixture });

    expect(analysis.documents.map((document) => document.relativePath)).toEqual([
      'README.md',
      'docs/guide.md',
      'docs/nested/deep.md',
      'drafts/ignored.md',
    ]);
    expect(analysis.references).toHaveLength(13);
  });

  it('consolidates references and static issues into a result', async () => {
    const analysis = await analyzeProject(['.'], { cwd: fixture });
    const result = buildCheckResult(analysis, analysis.issues, { durationMs: 12, uniqueUrls: 3 });

    expect(result.summary).toMatchObject({
      files: 4,
      references: 13,
      uniqueUrls: 3,
      errors: 1,
      warnings: 1,
      durationMs: 12,
    });
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'UNUSED_DEFINITION',
      'UNDEFINED_REFERENCE',
    ]);
    expect(result.documents).toContainEqual({ relativePath: 'docs/guide.md', references: 1 });
  });

  it('classifies references across the whole project', async () => {
    const analysis = await analyzeProject(['.'], { cwd: fixture });
    const countByKind = (kind: string) =>
      analysis.references.filter((reference) => reference.kind === kind).length;

    expect(countByKind('external-http')).toBe(3);
    expect(countByKind('cross-document-anchor')).toBe(3);
    expect(countByKind('local-image')).toBe(2);
    expect(countByKind('local-file')).toBe(4);
  });

  it('applies extra ignore rules on top of the defaults', async () => {
    const analysis = await analyzeProject(['.'], { cwd: fixture, ignore: ['drafts'] });

    expect(analysis.documents).toHaveLength(3);
    expect(analysis.references).toHaveLength(12);
  });
});
