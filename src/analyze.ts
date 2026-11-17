import { readFile } from 'node:fs/promises';
import { AnalysisError } from './errors.js';
import { DEFAULT_IGNORES } from './discovery/ignore.js';
import { discoverMarkdownFiles } from './discovery/walk.js';
import { extractDocument } from './markdown/extract.js';
import { classifyReference } from './references/classify.js';
import { validateStatic } from './validation/static.js';
import { compareStrings, relativePosix } from './utils/path.js';
import type { ProjectAnalysis } from './types.js';

export interface AnalyzeOptions {
  /** Base directory used to resolve targets and to print relative paths. */
  cwd: string;
  /** Extra ignore rules, merged with the defaults. */
  ignore?: readonly string[];
}

/**
 * Reads and analyses every Markdown document reachable from `targets`.
 *
 * This phase performs no validation of its own: it only builds the project
 * index (documents, anchors, classified references) plus the checks that need
 * no I/O.
 */
export async function analyzeProject(
  targets: readonly string[],
  options: AnalyzeOptions,
): Promise<ProjectAnalysis> {
  const files = await discoverMarkdownFiles(targets, {
    cwd: options.cwd,
    ignore: [...DEFAULT_IGNORES, ...(options.ignore ?? [])],
  });

  const documents = await Promise.all(
    files.map(async (absolutePath) => {
      let source: string;
      try {
        source = await readFile(absolutePath, 'utf8');
      } catch (error) {
        throw new AnalysisError(`cannot read file: ${absolutePath}`, { cause: error });
      }

      return extractDocument({
        source,
        absolutePath,
        relativePath: relativePosix(options.cwd, absolutePath),
      });
    }),
  );

  documents.sort((left, right) => compareStrings(left.relativePath, right.relativePath));

  return {
    cwd: options.cwd,
    documents,
    references: documents.flatMap((document) =>
      document.references.map((reference) => classifyReference(document, reference)),
    ),
    issues: documents.flatMap((document) => validateStatic(document)),
  };
}
