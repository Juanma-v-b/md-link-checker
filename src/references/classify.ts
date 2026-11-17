import path from 'node:path';
import type { ClassifiedReference, DocumentAnalysis, RawReference, ReferenceKind } from '../types.js';
import { normalizeAnchor } from '../markdown/slug.js';

const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const IS_HTTP = /^(?:https?:)?\/\//i;

/**
 * Turns a raw destination into something a validator can act on: what kind of
 * target it is, its path part, its fragment and, for local targets, the
 * absolute path it resolves to.
 */
export function classifyReference(
  document: DocumentAnalysis,
  reference: RawReference,
): ClassifiedReference {
  const destination = reference.destination.trim();
  const { href, anchor } = splitFragment(destination);

  const build = (
    kind: ReferenceKind,
    resolvedPath: string | null = null,
  ): ClassifiedReference => ({
    document,
    reference,
    kind,
    href,
    anchor,
    resolvedPath,
  });

  if (destination === '') {
    return build('other');
  }

  // Protocol-relative URLs (`//example.com/x`) are web links too.
  if (IS_HTTP.test(destination)) {
    return build('external-http');
  }

  // mailto:, tel:, file:, data:... are valid but out of scope.
  if (HAS_SCHEME.test(destination)) {
    return build('other');
  }

  // Root-relative paths depend on where the site is served from, which this
  // tool cannot know. Guessing would create false positives.
  if (href.startsWith('/')) {
    return build('other');
  }

  const queryIndex = href.indexOf('?');
  const pathPart = queryIndex === -1 ? href : href.slice(0, queryIndex);

  if (pathPart === '') {
    return anchor === null ? build('other') : build('same-document-anchor');
  }

  const targetPath = safeDecode(pathPart).replace(/\\/g, '/');
  const resolvedPath = path.resolve(path.dirname(document.absolutePath), targetPath);

  if (anchor !== null) {
    return build('cross-document-anchor', resolvedPath);
  }

  return build(reference.type === 'image' ? 'local-image' : 'local-file', resolvedPath);
}

function splitFragment(destination: string): { href: string; anchor: string | null } {
  const hashIndex = destination.indexOf('#');
  if (hashIndex === -1) {
    return { href: destination, anchor: null };
  }

  const href = destination.slice(0, hashIndex);
  const fragment = destination.slice(hashIndex + 1);

  return {
    href,
    anchor: fragment === '' ? null : normalizeAnchor(safeDecode(fragment)),
  };
}

/** `%20` and friends must become real characters before touching the filesystem. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
