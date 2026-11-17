import process from 'node:process';
import { analyzeProject } from '../analyze.js';
import { AnalysisError, DiscoveryError, UsageError } from '../errors.js';
import { EXIT_ISSUES, EXIT_OK, EXIT_USAGE } from '../exit-codes.js';
import { formatHumanReport } from '../report/human.js';
import { formatJsonReport } from '../report/json.js';
import { buildCheckResult } from '../report/summary.js';
import { validateProject } from '../validation/validate.js';
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

  return executeCheck(parsed.options, context);
}

async function executeCheck(options: CliOptions, context: RunContext): Promise<number> {
  const startedAt = performance.now();

  let analysis;
  try {
    analysis = await analyzeProject(options.targets, {
      cwd: context.cwd,
      ignore: options.ignore,
    });
  } catch (error) {
    if (error instanceof DiscoveryError || error instanceof AnalysisError) {
      context.stderr(`md-link-checker: ${error.message}\n`);
      return EXIT_USAGE;
    }
    throw error;
  }

  let issues = analysis.issues;
  let uniqueUrls = 0;

  if (!options.analyzeOnly) {
    const validation = await validateProject(analysis, {
      timeoutMs: options.timeoutMs,
      concurrency: options.concurrency,
      skipExternal: options.skipExternal,
    });

    issues = validation.issues;
    uniqueUrls = validation.checkedUrls;
  }

  const result = buildCheckResult(analysis, issues, {
    durationMs: Math.round(performance.now() - startedAt),
    uniqueUrls,
  });

  context.stdout(
    options.json
      ? formatJsonReport(result)
      : formatHumanReport(analysis, result, {
          analyzeOnly: options.analyzeOnly,
          skipExternal: options.skipExternal,
        }),
  );

  if (result.summary.errors > 0) {
    return EXIT_ISSUES;
  }

  if (options.strict && result.summary.warnings > 0) {
    return EXIT_ISSUES;
  }

  return EXIT_OK;
}
