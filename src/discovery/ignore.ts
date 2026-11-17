/**
 * Ignore rules.
 *
 * A rule without a slash matches any path segment (`node_modules` skips that
 * folder wherever it appears). A rule with a slash matches a path prefix
 * relative to the scanned directory (`docs/drafts`).
 */
export const DEFAULT_IGNORES = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.next',
  '.nuxt',
  '.output',
] as const;

export function isIgnoredPath(relativePath: string, rules: readonly string[]): boolean {
  const candidate = normalizePath(relativePath);
  if (candidate === '') {
    return false;
  }

  const segments = candidate.split('/');

  for (const rule of rules) {
    const pattern = normalizePath(rule);
    if (pattern === '') {
      continue;
    }

    if (pattern.includes('/')) {
      if (candidate === pattern || candidate.startsWith(`${pattern}/`)) {
        return true;
      }
    } else if (segments.includes(pattern)) {
      return true;
    }
  }

  return false;
}

/** Normalises separators so rules written on Windows behave the same way. */
export function normalizePath(value: string): string {
  return value
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '');
}
