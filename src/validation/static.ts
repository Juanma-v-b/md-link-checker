import type { DocumentAnalysis, Issue } from '../types.js';

/**
 * Checks that need no I/O: a reference used without a definition, and a
 * definition that nothing uses. Both are pure functions of the parsed document.
 */
export function validateStatic(document: DocumentAnalysis): Issue[] {
  const issues: Issue[] = [];

  for (const usage of document.unresolvedReferences) {
    issues.push({
      code: 'UNDEFINED_REFERENCE',
      severity: 'error',
      relativePath: document.relativePath,
      position: usage.position,
      message: `reference "${usage.id}" is used but never defined`,
      reference: usage.isImage ? `![${usage.id}]` : `[${usage.id}]`,
    });
  }

  const usedIds = new Set(document.usages.map((usage) => usage.id));

  for (const definition of document.definitions) {
    if (!usedIds.has(definition.id)) {
      issues.push({
        code: 'UNUSED_DEFINITION',
        severity: 'warning',
        relativePath: document.relativePath,
        position: definition.position,
        message: `definition "${definition.id}" is never used`,
        reference: `[${definition.id}]`,
      });
    }
  }

  return issues;
}
