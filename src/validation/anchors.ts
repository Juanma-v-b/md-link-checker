import type { DocumentAnalysis } from '../types.js';

/**
 * Anchors are already slugged and lowercased when they are extracted and when
 * a fragment is classified, so a plain membership check matches GitHub's
 * case-insensitive behaviour.
 */
export function documentHasAnchor(document: DocumentAnalysis, anchor: string): boolean {
  return document.anchors.includes(anchor);
}
