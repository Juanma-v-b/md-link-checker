import { parseArgs } from 'node:util';
import { UsageError } from '../errors.js';
import type { CliOptions, ParsedArgs } from '../types.js';

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_CONCURRENCY = 8;
export const MAX_CONCURRENCY = 64;

const CLI_OPTIONS = {
  ignore: { type: 'string', multiple: true },
  timeout: { type: 'string' },
  concurrency: { type: 'string' },
  'skip-external': { type: 'boolean' },
  'analyze-only': { type: 'boolean' },
  json: { type: 'boolean' },
  strict: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
} as const;

type ParseResult = ReturnType<typeof safeParse>;

function safeParse(argv: readonly string[]): {
  values: {
    ignore?: string[];
    timeout?: string;
    concurrency?: string;
    'skip-external'?: boolean;
    'analyze-only'?: boolean;
    json?: boolean;
    strict?: boolean;
    help?: boolean;
    version?: boolean;
  };
  positionals: string[];
} {
  try {
    return parseArgs({
      args: [...argv],
      options: CLI_OPTIONS,
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    // `parseArgs` throws plain TypeErrors with user-facing messages such as
    // "Unknown option '--foo'"; surface them as usage errors.
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Turns raw arguments into a `ParsedArgs` discriminated union.
 * Throws `UsageError` on any invalid input.
 */
export function parseCliArgs(argv: readonly string[]): ParsedArgs {
  const { values, positionals }: ParseResult = safeParse(argv);

  if (values.help === true) {
    return { command: 'help' };
  }

  if (values.version === true) {
    return { command: 'version' };
  }

  const targets = positionals.filter((target) => target.trim() !== '');
  if (targets.length === 0) {
    throw new UsageError('no targets provided. Pass a Markdown file or a directory.');
  }

  const options: CliOptions = {
    targets,
    ignore: parseIgnores(values.ignore ?? []),
    timeoutMs: parseIntegerFlag(values.timeout, '--timeout', 1, 600_000, DEFAULT_TIMEOUT_MS),
    concurrency: parseIntegerFlag(
      values.concurrency,
      '--concurrency',
      1,
      MAX_CONCURRENCY,
      DEFAULT_CONCURRENCY,
    ),
    json: values.json === true,
    strict: values.strict === true,
    skipExternal: values['skip-external'] === true,
    analyzeOnly: values['analyze-only'] === true,
  };

  return { command: 'check', options };
}

/** `--ignore a,b --ignore c` becomes `['a', 'b', 'c']`, without duplicates. */
function parseIgnores(rawValues: readonly string[]): string[] {
  const entries = rawValues
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return [...new Set(entries)];
}

function parseIntegerFlag(
  raw: string | undefined,
  flag: string,
  min: number,
  max: number,
  fallback: number,
): number {
  if (raw === undefined) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new UsageError(
      `${flag} expects an integer between ${min} and ${max}, received "${raw}".`,
    );
  }

  return value;
}
