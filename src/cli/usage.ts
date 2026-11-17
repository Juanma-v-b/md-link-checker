import {
  DEFAULT_CONCURRENCY,
  DEFAULT_IGNORES,
  DEFAULT_TIMEOUT_MS,
  MAX_CONCURRENCY,
} from './args.js';

/** Help text. Kept as a template so defaults never drift from the parser. */
export const USAGE = `md-link-checker — find broken links in Markdown files

Usage:
  md-link-checker <path...> [options]

Paths can be Markdown files, directories (scanned recursively) or both.

Options:
  --ignore <list>     Comma-separated directories or paths to skip
                      (default: ${DEFAULT_IGNORES.join(', ')})
  --timeout <ms>      Timeout per HTTP request (default: ${DEFAULT_TIMEOUT_MS})
  --concurrency <n>   Concurrent HTTP requests, 1-${MAX_CONCURRENCY} (default: ${DEFAULT_CONCURRENCY})
  --skip-external     Do not check external URLs
  --analyze-only      List discovered references without validating them
  --json              Print a machine-readable report
  --strict            Treat warnings as failures
  -h, --help          Show this help
  -v, --version       Show the version

Exit codes:
  0  No issues found
  1  Issues found
  2  Invalid usage or configuration

Examples:
  md-link-checker README.md
  md-link-checker docs --ignore node_modules,dist
  md-link-checker . --json --strict > report.json
`;

export function formatUsage(): string {
  return USAGE;
}
