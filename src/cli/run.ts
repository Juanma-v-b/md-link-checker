import process from 'node:process';
import { UsageError } from '../errors.js';
import { EXIT_OK, EXIT_USAGE } from '../exit-codes.js';
import type { CliOptions, ParsedArgs } from '../types.js';
import { VERSION } from '../version.js';
import { parseCliArgs } from './args.js';
import { formatUsage } from './usage.js';

/** Injectable process boundary, so tests can capture output without spawning. */
export interface RunContext {
  cwd: string;
  stdout: (chunk: string) => void;
  stderr: (chunk: string) => void;
}

function defaultContext(): RunContext {
  return {
    cwd: process.cwd(),
    stdout: (chunk) => {
      process.stdout.write(chunk);
    },
    stderr: (chunk) => {
      process.stderr.write(chunk);
    },
  };
}

/**
 * Runs the CLI and returns the process exit code.
 * Never calls `process.exit`, so it is safe to use programmatically.
 */
export async function run(
  argv: readonly string[],
  overrides: Partial<RunContext> = {},
): Promise<number> {
  const context: RunContext = { ...defaultContext(), ...overrides };

  let parsed: ParsedArgs;
  try {
    parsed = parseCliArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) {
      throw error;
    }
    context.stderr(`md-link-checker: ${error.message}\n\nRun "md-link-checker --help" for usage.\n`);
    return EXIT_USAGE;
  }

  if (parsed.command === 'help') {
    context.stdout(formatUsage());
    return EXIT_OK;
  }

  if (parsed.command === 'version') {
    context.stdout(`md-link-checker ${VERSION}\n`);
    return EXIT_OK;
  }

  executeCheck(parsed.options, context);
  return EXIT_USAGE;
}

/**
 * The pipeline (discovery → analysis → validation → report) is added in PR #1
 * and PR #2. Until then the command fails loudly instead of pretending that
 * the project was checked.
 */
function executeCheck(options: CliOptions, context: RunContext): void {
  context.stderr(
    `md-link-checker: analysis engine not implemented yet (targets: ${options.targets.join(', ')}).\n`,
  );
}
