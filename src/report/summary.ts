import { compareStrings } from '../utils/path.js';
import type { CheckResult, CheckSummary, Issue, ProjectAnalysis } from '../types.js';

export interface ReportOptions {
  durationMs: number;
  /** Unique external URLs that were actually requested. */
  uniqueUrls: number;
}

/**
 * Aggregates the analysis and its issues into the stable, machine-readable
 * shape used by `--json` and by the human report.
 */
export function buildCheckResult(
  analysis: ProjectAnalysis,
  issues: readonly Issue[],
  options: ReportOptions,
): CheckResult {
  const sortedIssues = [...issues].sort(compareIssues);
  const errors = sortedIssues.filter((issue) => issue.severity === 'error').length;

  const summary: CheckSummary = {
    files: analysis.documents.length,
    references: analysis.references.length,
    uniqueUrls: options.uniqueUrls,
    errors,
    warnings: sortedIssues.length - errors,
    durationMs: options.durationMs,
  };

  return {
    schemaVersion: 1,
    summary,
    documents: analysis.documents.map((document) => ({
      relativePath: document.relativePath,
      references: document.references.length,
    })),
    issues: sortedIssues,
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
