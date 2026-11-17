import { describe, expect, it } from 'vitest';
import { run } from '../../../src/cli/run.js';
import { EXIT_OK, EXIT_USAGE } from '../../../src/exit-codes.js';
import { VERSION } from '../../../src/version.js';

interface Captured {
  code: number;
  stdout: string;
  stderr: string;
}

async function capture(...argv: string[]): Promise<Captured> {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const code = await run(argv, {
    stdout: (chunk) => void stdout.push(chunk),
    stderr: (chunk) => void stderr.push(chunk),
  });

  return { code, stdout: stdout.join(''), stderr: stderr.join('') };
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
    expect(result.stdout).toBe('');
  });

  it('fails with a usage error for unknown flags', async () => {
    const result = await capture('docs', '--nope');
    expect(result.code).toBe(EXIT_USAGE);
    expect(result.stderr).toContain('--nope');
  });

  it('does not report success while the engine is missing', async () => {
    const result = await capture('docs');
    expect(result.code).not.toBe(EXIT_OK);
    expect(result.stderr).toContain('not implemented');
  });
});
