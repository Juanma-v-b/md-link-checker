import { stat } from 'node:fs/promises';

export type PathStatus = 'file' | 'directory' | 'missing' | 'unreadable';

/** What is actually on disk at `absolutePath`, without throwing on ENOENT. */
export async function statPath(absolutePath: string): Promise<PathStatus> {
  try {
    const stats = await stat(absolutePath);

    if (stats.isFile()) {
      return 'file';
    }

    return stats.isDirectory() ? 'directory' : 'unreadable';
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === 'ENOENT' || code === 'ENOTDIR' ? 'missing' : 'unreadable';
  }
}

/**
 * Wraps `statPath` with a cache: the same target is resolved once even when it
 * appears in dozens of references.
 */
export function createPathStatusCache(): (absolutePath: string) => Promise<PathStatus> {
  const cache = new Map<string, Promise<PathStatus>>();

  return (absolutePath) => {
    const cached = cache.get(absolutePath);
    if (cached !== undefined) {
      return cached;
    }

    const pending = statPath(absolutePath);
    cache.set(absolutePath, pending);
    return pending;
  };
}
