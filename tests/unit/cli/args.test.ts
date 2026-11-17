import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONCURRENCY,
  DEFAULT_TIMEOUT_MS,
  parseCliArgs,
} from '../../../src/cli/args.js';
import { UsageError } from '../../../src/errors.js';
import type { CliOptions } from '../../../src/types.js';

function parseCheck(...argv: string[]): CliOptions {
  const parsed = parseCliArgs(argv);
  if (parsed.command !== 'check') {
    throw new Error(`Expected the "check" command, received "${parsed.command}".`);
  }
  return parsed.options;
}

describe('parseCliArgs', () => {
  it('applies defaults for a single target', () => {
    expect(parseCheck('docs')).toEqual({
      targets: ['docs'],
      ignore: [],
      timeoutMs: DEFAULT_TIMEOUT_MS,
      concurrency: DEFAULT_CONCURRENCY,
      json: false,
      strict: false,
      skipExternal: false,
      analyzeOnly: false,
    });
  });

  it('keeps several targets in order', () => {
    expect(parseCheck('README.md', 'docs', '--json').targets).toEqual(['README.md', 'docs']);
  });

  it('accepts flags before positionals', () => {
    expect(parseCheck('--json', 'README.md').targets).toEqual(['README.md']);
  });

  it('splits comma-separated and repeated --ignore values', () => {
    const options = parseCheck('docs', '--ignore', 'tmp, vendor', '--ignore', 'tmp', '--ignore=');
    expect(options.ignore).toEqual(['tmp', 'vendor']);
  });

  it('supports the --flag=value syntax', () => {
    expect(parseCheck('--ignore=drafts,legacy', 'docs').ignore).toEqual(['drafts', 'legacy']);
  });

  it('parses numeric flags', () => {
    const options = parseCheck('docs', '--timeout', '2500', '--concurrency=3');
    expect(options.timeoutMs).toBe(2500);
    expect(options.concurrency).toBe(3);
  });

  it('parses boolean flags', () => {
    const options = parseCheck('docs', '--json', '--strict', '--skip-external', '--analyze-only');
    expect(options).toMatchObject({
      json: true,
      strict: true,
      skipExternal: true,
      analyzeOnly: true,
    });
  });

  it('returns the help command for -h and --help', () => {
    expect(parseCliArgs(['--help'])).toEqual({ command: 'help' });
    expect(parseCliArgs(['-h'])).toEqual({ command: 'help' });
  });

  it('returns the version command for -v and --version', () => {
    expect(parseCliArgs(['--version'])).toEqual({ command: 'version' });
    expect(parseCliArgs(['-v'])).toEqual({ command: 'version' });
  });

  it('treats arguments after -- as positionals', () => {
    expect(parseCheck('--', '--weird-name.md').targets).toEqual(['--weird-name.md']);
  });

  it('rejects a missing target', () => {
    expect(() => parseCliArgs([])).toThrow(UsageError);
    expect(() => parseCliArgs(['   '])).toThrow(/no targets/i);
    expect(() => parseCliArgs(['--json'])).toThrow(/no targets/i);
  });

  it('rejects unknown flags', () => {
    expect(() => parseCliArgs(['docs', '--nope'])).toThrow(UsageError);
    expect(() => parseCliArgs(['docs', '--nope'])).toThrow(/nope/);
  });

  it('rejects a flag without its value', () => {
    expect(() => parseCliArgs(['docs', '--timeout'])).toThrow(UsageError);
  });

  it.each(['abc', '0', '-5', '1.5', ''])('rejects an invalid --timeout value: %s', (value) => {
    expect(() => parseCliArgs(['docs', '--timeout', value])).toThrow(UsageError);
  });

  it.each(['0', '65', '-1', '2.5'])('rejects an invalid --concurrency value: %s', (value) => {
    expect(() => parseCliArgs(['docs', '--concurrency', value])).toThrow(/concurrency/);
  });
});
