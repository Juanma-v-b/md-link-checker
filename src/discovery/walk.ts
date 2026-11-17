import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { DiscoveryError } from '../errors.js';
import { compareStrings, relativePosix } from '../utils/path.js';
import { isIgnoredPath } from './ignore.js';

export const MARKDOWN_EXTENSIONS = ['.md', '.markdown'] as const;

export interface DiscoverOptions {
  cwd: string;
  /** Effective ignore rules (defaults plus user overrides). */
  ignore?: readonly string[];
  extensions?: readonly string[];
}

/**
 * Resolves the given targets (files or directories) into a sorted, de-duplicated
 * list of absolute Markdown paths. Directories are walked recursively; symbolic
 * links are skipped so a loop can never hang the process.
 */
export async function discoverMarkdownFiles(
  targets: readonly string[],
  options: DiscoverOptions,
): Promise<string[]> {
  const extensions = options.extensions ?? MARKDOWN_EXTENSIONS;
  const rules = options.ignore ?? [];
  const found = new Set<string>();

  for (const target of targets) {
    const absolutePath = path.resolve(options.cwd, target);
    const targetStat = await statOrThrow(absolutePath, target);

    if (targetStat.isFile()) {
      if (!hasExtension(absolutePath, extensions)) {
        throw new DiscoveryError(`not a Markdown file: ${target}`);
      }
      found.add(absolutePath);
      continue;
    }

    if (!targetStat.isDirectory()) {
      throw new DiscoveryError(`unsupported path: ${target}`);
    }

    const relativeRoot = relativePosix(options.cwd, absolutePath);
    await walkDirectory(absolutePath, relativeRoot, rules, extensions, found);
  }

  return [...found].sort(compareStrings);
}

async function walkDirectory(
  absoluteDir: string,
  relativeDir: string,
  rules: readonly string[],
  extensions: readonly string[],
  found: Set<string>,
): Promise<void> {
  let entries;
  try {
    entries = await readdir(absoluteDir, { withFileTypes: true });
  } catch (error) {
    throw new DiscoveryError(`cannot read directory: ${absoluteDir}`, { cause: error });
  }

  // Sort before recursing so the output does not depend on the filesystem.
  entries.sort((left, right) => compareStrings(left.name, right.name));

  for (const entry of entries) {
    const relativePath = relativeDir === '' ? entry.name : `${relativeDir}/${entry.name}`;

    if (isIgnoredPath(relativePath, rules) || entry.isSymbolicLink()) {
      continue;
    }

    const absolutePath = path.join(absoluteDir, entry.name);

    if (entry.isDirectory()) {
      await walkDirectory(absolutePath, relativePath, rules, extensions, found);
    } else if (entry.isFile() && hasExtension(entry.name, extensions)) {
      found.add(absolutePath);
    }
  }
}

async function statOrThrow(absolutePath: string, target: string) {
  try {
    return await stat(absolutePath);
  } catch (error) {
    throw new DiscoveryError(`path not found: ${target}`, { cause: error });
  }
}

function hasExtension(filePath: string, extensions: readonly string[]): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return extensions.includes(extension);
}
