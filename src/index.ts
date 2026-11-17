/**
 * Public API. Consumers can import the programmatic entry point without
 * going through `process.argv`, which is also what the integration tests do.
 */
export { run } from './cli/run.js';
export type { RunContext } from './cli/run.js';
export { EXIT_ISSUES, EXIT_OK, EXIT_USAGE } from './exit-codes.js';
export { VERSION } from './version.js';
export type * from './types.js';
