/**
 * Raised for invalid command-line input: unknown flags, missing values or
 * missing targets. The CLI turns it into exit code 2 instead of a stack trace.
 */
export class UsageError extends Error {
  override name = 'UsageError';
}
