import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { run } from '../../../src/cli/run.js';
import { EXIT_ISSUES, EXIT_OK, EXIT_USAGE } from '../../../src/exit-codes.js';
import type { CheckResult } from '../../../src/types.js';
import { VERSION } from '../../../src/version.js';

interface Captured {
  code: number;
  stdout: string;
  stderr: string;
}

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), 'md-link-checker-run-'));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

async function capture(...argv: string[]): Promise<Captured> {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const code = await run(argv, {
    cwd: workspace,
    stdout: (chunk) => void stdout.push(chunk),
    stderr: (chunk) => void stderr.push(chunk),
  });

  return { code, stdout: stdout.join(''), stderr: stderr.join('') };
}

async function createDocument(name: string, content: string): Promise<void> {
  const absolutePath = path.join(workspace, name);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, 'utf8');
}

describe('run', () => {
  it('prints the usage with --help and exits successfully', async () => {
    const result = await capture('--help');

    expect(result.code).toBe(EXIT_OK);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('--skip-external');
  });

  it('prints the version with --version', async () => {
    const result = await capture('--version');

    expect(result.code).toBe(EXIT_OK);
    expect(result.stdout.trim()).toBe(`md-link-checker ${VERSION}`);
  });

  it('fails with a usage error when no target is given', async () => {
    const result = await capture();

    expect(result.code).toBe(EXIT_USAGE);
    expect(result.stderr).toMatch(/no targets/i);
  });

  it('fails with a usage error for unknown flags', async () => {
    const result = await capture('docs', '--nope');

    expect(result.code).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('--nope');
  });

  it('fails with a usage error when the target does not exist', async () => {
    const result = await capture('missing.md');

    expect(result.code).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('path not found');
  });

  it('reports a clean project and exits with 0', async () => {
    await createDocument('doc.md', '# Title\n\n[link](#title)\n');

    const result = await capture('.');

    expect(result.code).toBe(EXIT_OK);
    expect(result.stdout).toContain('Analyzed 1 file and 1 reference.');
    expect(result.stdout).toContain('No problems found.');
  });

  it('exits with 1 when a reference has no definition', async () => {
    await createDocument('doc.md', '# Title\n\n[missing][nope]\n');

    const result = await capture('.');

    expect(result.code).toBe(EXIT_ISSUES);
    expect(result.stdout).toContain('UNDEFINED_REFERENCE');
    expect(result.stdout).toContain('doc.md:3:1');
  });

  it('exits with 0 for warnings unless --strict is used', async () => {
    await createDocument('doc.md', '# Title\n\n[unused]: https://example.com\n');

    expect((await capture('.')).code).toBe(EXIT_OK);
    expect((await capture('.', '--strict')).code).toBe(EXIT_ISSUES);
  });

  it('walks directories and applies --ignore', async () => {
    await createDocument('docs/a.md', '# A\n\n[ok](https://example.com)\n');
    await createDocument('drafts/b.md', '# B\n\n[missing][nope]\n');

    const ignored = await capture('.', '--ignore', 'drafts');

    expect(ignored.code).toBe(EXIT_OK);
    expect(ignored.stdout).not.toContain('drafts/b.md');
  });

  it('prints a machine-readable report with --json', async () => {
    await createDocument('doc.md', '# Title\n\n[missing][nope]\n');

    const result = await capture('.', '--json');
    const report = JSON.parse(result.stdout) as CheckResult;

    expect(result.code).toBe(EXIT_ISSUES);
    expect(report.schemaVersion).toBe(1);
    expect(report.summary).toMatchObject({ files: 1, references: 0, errors: 1, warnings: 0 });
    expect(report.issues[0]).toMatchObject({
      code: 'UNDEFINED_REFERENCE',
      relativePath: 'doc.md',
      position: { line: 3, column: 1 },
    });
  });
});
