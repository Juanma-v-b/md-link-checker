import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { MARKDOWN_EXTENSIONS } from '../discovery/walk.js';
import { extractDocument } from '../markdown/extract.js';
import { mapLimit } from '../utils/concurrency.js';
import type {
  ClassifiedReference,
  DocumentAnalysis,
  Issue,
  IssueCode,
  ProjectAnalysis,
  Severity,
} from '../types.js';
import { documentHasAnchor } from './anchors.js';
import { checkUrl, type HttpFailure, type HttpOutcome } from './http.js';
import { createPathStatusCache, type PathStatus } from './local.js';

export interface ValidationOptions {
  /** Per-request HTTP timeout in milliseconds. */
  timeoutMs: number;
  /** Maximum number of concurrent HTTP requests. */
  concurrency: number;
  /** Skip external checks entirely (`--skip-external`). */
  skipExternal: boolean;
}

export interface ValidationReport {
  issues: Issue[];
  /** Unique external URLs that were actually requested. */
  checkedUrls: number;
}

const PATH_LOOKUP_CONCURRENCY = 64;

/**
 * Validates every classified reference: local files and images against the
 * filesystem, fragments against the anchors of the target document, and
 * external URLs against the network.
 *
 * Static issues found during analysis are kept, so the returned list is the
 * complete set of problems.
 */
export async function validateProject(
  analysis: ProjectAnalysis,
  options: ValidationOptions,
): Promise<ValidationReport> {
  const issues: Issue[] = [...analysis.issues];

  const pathStatus = await resolvePathStatuses(analysis.references);
  collectLocalIssues(analysis.references, pathStatus, issues);

  const anchorIndex = createAnchorIndex(
    new Map(analysis.documents.map((document) => [document.absolutePath, document])),
  );
  await collectAnchorIssues(analysis.references, pathStatus, anchorIndex, issues);

  const urls = collectExternalUrls(analysis.references, options.skipExternal);
  const outcomes = await checkUrls(urls, options);

  for (const [url, references] of urls) {
    const outcome = outcomes.get(url);
    if (outcome === undefined || outcome.ok) {
      continue;
    }

    for (const reference of references) {
      issues.push(httpIssue(reference, outcome.failure, url));
    }
  }

  return { issues, checkedUrls: urls.size };
}

async function resolvePathStatuses(
  references: readonly ClassifiedReference[],
): Promise<Map<string, PathStatus>> {
  const paths = new Set<string>();
  for (const reference of references) {
    if (reference.resolvedPath !== null) {
      paths.add(reference.resolvedPath);
    }
  }

  const statusOf = createPathStatusCache();
  const statuses = new Map<string, PathStatus>();

  await mapLimit([...paths], PATH_LOOKUP_CONCURRENCY, async (absolutePath) => {
    statuses.set(absolutePath, await statusOf(absolutePath));
    return null;
  });

  return statuses;
}

function collectLocalIssues(
  references: readonly ClassifiedReference[],
  pathStatus: ReadonlyMap<string, PathStatus>,
  issues: Issue[],
): void {
  for (const reference of references) {
    if (reference.resolvedPath === null) {
      continue;
    }

    const status = pathStatus.get(reference.resolvedPath);

    switch (status) {
      case 'missing':
        issues.push(
          issueFor(
            reference,
            'BROKEN_LOCAL_FILE',
            'error',
            `${reference.reference.type === 'image' ? 'image' : 'file'} not found: ${reference.href}`,
          ),
        );
        break;

      case 'directory':
        issues.push(
          issueFor(
            reference,
            'BROKEN_LOCAL_FILE',
            'error',
            `expected a file but found a directory: ${reference.href}`,
          ),
        );
        break;

      case 'unreadable':
        issues.push(
          issueFor(
            reference,
            'BROKEN_LOCAL_FILE',
            'error',
            `cannot access path: ${reference.href}`,
          ),
        );
        break;

      default:
        break;
    }
  }
}

type AnchorLookup = (absolutePath: string) => Promise<Set<string> | null>;

/**
 * Returns the anchor set of a target document. Files that were not part of the
 * scan but are Markdown are parsed on demand, so links pointing outside the
 * analysed targets still get their fragment checked. Non-Markdown targets
 * return `null`: their anchors cannot be verified without fetching the page.
 */
function createAnchorIndex(documents: ReadonlyMap<string, DocumentAnalysis>): AnchorLookup {
  const cache = new Map<string, Set<string> | null>();

  return async (absolutePath) => {
    if (cache.has(absolutePath)) {
      return cache.get(absolutePath) ?? null;
    }

    const document = documents.get(absolutePath);
    if (document !== undefined) {
      const anchors = new Set(document.anchors);
      cache.set(absolutePath, anchors);
      return anchors;
    }

    if (!isMarkdownPath(absolutePath)) {
      cache.set(absolutePath, null);
      return null;
    }

    try {
      const source = await readFile(absolutePath, 'utf8');
      const parsed = extractDocument({ source, absolutePath, relativePath: absolutePath });
      const anchors = new Set(parsed.anchors);
      cache.set(absolutePath, anchors);
      return anchors;
    } catch {
      cache.set(absolutePath, null);
      return null;
    }
  };
}

async function collectAnchorIssues(
  references: readonly ClassifiedReference[],
  pathStatus: ReadonlyMap<string, PathStatus>,
  anchorIndex: AnchorLookup,
  issues: Issue[],
): Promise<void> {
  for (const reference of references) {
    const { anchor } = reference;

    if (anchor === null) {
      continue;
    }

    if (reference.kind === 'same-document-anchor') {
      if (!documentHasAnchor(reference.document, anchor)) {
        issues.push(
          issueFor(
            reference,
            'MISSING_ANCHOR',
            'error',
            `anchor "#${anchor}" not found in this document`,
          ),
        );
      }
      continue;
    }

    if (reference.kind !== 'cross-document-anchor' || reference.resolvedPath === null) {
      continue;
    }

    // If the target file does not exist, that is already reported as a broken
    // link; there is no point in adding a second issue about its anchors.
    if (pathStatus.get(reference.resolvedPath) !== 'file') {
      continue;
    }

    const anchors = await anchorIndex(reference.resolvedPath);
    if (anchors === null) {
      continue;
    }

    if (!anchors.has(anchor)) {
      issues.push(
        issueFor(
          reference,
          'MISSING_ANCHOR',
          'error',
          `anchor "#${anchor}" not found in ${reference.href}`,
        ),
      );
    }
  }
}

function collectExternalUrls(
  references: readonly ClassifiedReference[],
  skipExternal: boolean,
): Map<string, ClassifiedReference[]> {
  const urls = new Map<string, ClassifiedReference[]>();

  if (skipExternal) {
    return urls;
  }

  for (const reference of references) {
    if (reference.kind !== 'external-http') {
      continue;
    }

    const bucket = urls.get(reference.href);
    if (bucket === undefined) {
      urls.set(reference.href, [reference]);
    } else {
      bucket.push(reference);
    }
  }

  return urls;
}

async function checkUrls(
  urls: ReadonlyMap<string, readonly ClassifiedReference[]>,
  options: ValidationOptions,
): Promise<Map<string, HttpOutcome>> {
  const outcomes = new Map<string, HttpOutcome>();

  await mapLimit([...urls.keys()], options.concurrency, async (url) => {
    outcomes.set(url, await checkUrl(url, { timeoutMs: options.timeoutMs }));
    return null;
  });

  return outcomes;
}

function httpIssue(
  reference: ClassifiedReference,
  failure: HttpFailure,
  url: string,
): Issue {
  return issueFor(reference, failure.code, failure.severity, `${failure.message} (${url})`);
}

function issueFor(
  reference: ClassifiedReference,
  code: IssueCode,
  severity: Severity,
  message: string,
): Issue {
  return {
    code,
    severity,
    relativePath: reference.document.relativePath,
    position: reference.reference.position,
    message,
    reference: reference.reference.destination,
  };
}

function isMarkdownPath(absolutePath: string): boolean {
  const extension = extname(absolutePath).toLowerCase();
  return (MARKDOWN_EXTENSIONS as readonly string[]).includes(extension);
}
