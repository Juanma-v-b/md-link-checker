import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { analyzeProject } from '../../src/analyze.js';
import type { IssueCode } from '../../src/types.js';
import { validateProject } from '../../src/validation/validate.js';
import { startTestServer, type TestServer } from './support/server.js';

const fixture = fileURLToPath(new URL('../fixtures/project-a', import.meta.url));

const validationOptions = { timeoutMs: 50, concurrency: 4, skipExternal: true };

function countCode(issues: readonly { code: IssueCode }[], code: IssueCode): number {
  return issues.filter((issue) => issue.code === code).length;
}

describe('validateProject', () => {
  it('checks local files and anchors without touching the network', async () => {
    const analysis = await analyzeProject(['.'], { cwd: fixture, ignore: ['drafts'] });
    const report = await validateProject(analysis, validationOptions);

    expect(report.checkedUrls).toBe(0);
    expect(countCode(report.issues, 'BROKEN_LOCAL_FILE')).toBe(2);
    expect(countCode(report.issues, 'MISSING_ANCHOR')).toBe(1);
    expect(countCode(report.issues, 'UNDEFINED_REFERENCE')).toBe(1);
    expect(countCode(report.issues, 'UNUSED_DEFINITION')).toBe(1);

    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_ANCHOR',
        relativePath: 'README.md',
        position: { line: 20, column: 1 },
      }),
    );
  });

  it('accepts the valid references of the fixture', async () => {
    const analysis = await analyzeProject(['.'], { cwd: fixture, ignore: ['drafts'] });
    const report = await validateProject(analysis, validationOptions);

    const valid = report.issues.filter(
      (issue) =>
        issue.position.line === 3 || issue.position.line === 5 || issue.position.line === 7,
    );

    expect(valid).toEqual([]);
  });
});

describe('validateProject with HTTP', () => {
  let server: TestServer;
  let workspace: string;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(async () => {
    workspace = await mkdtemp(path.join(tmpdir(), 'md-link-checker-validate-'));
    server.requests.clear();
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  async function validateDocument(
    content: string,
    timeoutMs = 1_000,
  ): Promise<Awaited<ReturnType<typeof validateProject>>> {
    await writeFile(path.join(workspace, 'doc.md'), content, 'utf8');
    const analysis = await analyzeProject(['.'], { cwd: workspace });
    return validateProject(analysis, { ...validationOptions, skipExternal: false, timeoutMs });
  }

  it('classifies broken, blocked and looping URLs', async () => {
    const report = await validateDocument(
      [
        '# Links',
        '',
        `[ok](${server.baseUrl}/ok)`,
        `[redirect](${server.baseUrl}/redirect)`,
        `[missing](${server.baseUrl}/missing)`,
        `[blocked](${server.baseUrl}/blocked)`,
        `[loop](${server.baseUrl}/loop)`,
        '',
      ].join('\n'),
    );

    expect(report.checkedUrls).toBe(5);
    expect(report.issues).toHaveLength(3);
    expect(countCode(report.issues, 'HTTP_ERROR')).toBe(1);
    expect(countCode(report.issues, 'HTTP_BLOCKED')).toBe(1);
    expect(countCode(report.issues, 'REDIRECT_LOOP')).toBe(1);
  });

  it('warns about a timeout instead of failing', async () => {
    const report = await validateDocument(`[slow](${server.baseUrl}/slow)\n`, 50);

    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({ code: 'HTTP_TIMEOUT', severity: 'warning' });
  });

  it('requests each unique URL only once', async () => {
    const url = `${server.baseUrl}/ok`;

    const report = await validateDocument(`[a](${url}) and [b](${url})\n`);

    expect(report.checkedUrls).toBe(1);
    expect(server.requests.get('/ok')).toBe(1);
    expect(report.issues).toEqual([]);
  });

  it('skips external checks when asked to', async () => {
    await writeFile(
      path.join(workspace, 'doc.md'),
      `[missing](${server.baseUrl}/missing)\n`,
      'utf8',
    );

    const analysis = await analyzeProject(['.'], { cwd: workspace });
    const report = await validateProject(analysis, validationOptions);

    expect(report.checkedUrls).toBe(0);
    expect(server.requests.size).toBe(0);
    expect(report.issues).toEqual([]);
  });

  it('reports every occurrence of a broken URL at its own position', async () => {
    const url = `${server.baseUrl}/missing`;

    const report = await validateDocument(`[a](${url})\n\n[b](${url})\n`);

    expect(report.issues).toHaveLength(2);
    expect(report.issues.map((issue) => issue.position.line)).toEqual([1, 3]);
  });
});
