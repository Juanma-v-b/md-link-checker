import path from 'node:path';

/** Markdown targets always use forward slashes in reports, whatever the OS. */
export function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/');
}

/** Path of `to` relative to `from`, using forward slashes. */
export function relativePosix(from: string, to: string): string {
  return toPosixPath(path.relative(from, to));
}

export function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}
