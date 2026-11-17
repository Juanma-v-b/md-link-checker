import { compareStrings } from '../utils/path.js';
import type { CheckResult, CheckSummary, Issue, ProjectAnalysis } from '../types.js';

/**
 * Aggregates a project analysis into the stable, machine-readable shape used
 * by `--json` and by the human report.
 */
export function buildCheckResult(analysis: ProjectAnalysis, durationMs: number): CheckResult {
  const issues = [...analysis.issues].sort(compareIssues);
  const errors = issues.filter((issue) => issue.severity === 'error').length;

  const summary: CheckSummary = {
    files: analysis.documents.length,
    references: analysis.references.length,
    uniqueUrls: new Set(
      analysis.references
        .filter((reference) => reference.kind === 'external-http')
        .map((reference) => reference.href),
    ).size,
    errors,
    warnings: issues.length - errors,
    durationMs,
  };

  return {
    schemaVersion: 1,
    summary,
    documents: analysis.documents.map((document) => ({
      relativePath: document.relativePath,
      references: document.references.length,
    })),
    issues,
  };
}

function compareIssues(left: Issue, right: Issue): number {
  return (
    compareStrings(left.relativePath, right.relativePath) ||
    left.position.line - right.position.line ||
    left.position.column - right.position.column ||
    compareStrings(left.code, right.code)
  );
}
