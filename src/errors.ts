/**
 * Raised for invalid command-line input: unknown flags, missing values or
 * missing targets. The CLI turns it into exit code 2 instead of a stack trace.
 */
export class UsageError extends Error {
  override name = 'UsageError';
}

/** A target path does not exist, is not readable, or is not Markdown. */
export class DiscoveryError extends Error {
  override name = 'DiscoveryError';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

/** A discovered file could not be read from disk. */
export class AnalysisError extends Error {
  override name = 'AnalysisError';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}
