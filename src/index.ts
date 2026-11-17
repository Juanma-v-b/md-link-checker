/**
 * Public API. Consumers can import the programmatic entry points without
 * going through `process.argv`, which is also what the integration tests do.
 */
export { analyzeProject } from './analyze.js';
export type { AnalyzeOptions } from './analyze.js';
export { run } from './cli/run.js';
export type { RunContext } from './cli/run.js';
export { validateProject } from './validation/validate.js';
export type { ValidationOptions, ValidationReport } from './validation/validate.js';
export { EXIT_ISSUES, EXIT_OK, EXIT_USAGE } from './exit-codes.js';
export { VERSION } from './version.js';
export type * from './types.js';
