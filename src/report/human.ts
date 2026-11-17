import type { CheckResult, ClassifiedReference, Issue, ProjectAnalysis } from '../types.js';

export interface HumanReportOptions {
  analyzeOnly: boolean;
  skipExternal: boolean;
}

/**
 * Terminal report. In the default mode it lists the problems grouped by
 * document; with `--analyze-only` it also prints the inventory of every
 * reference found. Positions use `file:line:col` so editors and terminals can
 * make them clickable.
 */
export function formatHumanReport(
  analysis: ProjectAnalysis,
  result: CheckResult,
  options: HumanReportOptions,
): string {
  const { summary } = result;
  const lines: string[] = [];

  if (options.analyzeOnly) {
    lines.push(
      `Analyzed ${count(summary.files, 'file')} and ${count(summary.references, 'reference')}.`,
      '',
    );
    appendInventory(analysis, lines);
  } else {
    const urls =
      summary.uniqueUrls > 0 ? ` (${count(summary.uniqueUrls, 'unique URL')})` : '';
    lines.push(
      `Checked ${count(summary.files, 'file')} and ${count(summary.references, 'reference')}${urls}.`,
      '',
    );
  }

  appendIssues(result.issues, lines);

  lines.push(
    `Summary: ${count(summary.files, 'file')}, ${count(summary.references, 'reference')}, ` +
      `${count(summary.errors, 'error')}, ${count(summary.warnings, 'warning')} ` +
      `(${summary.durationMs} ms)`,
  );

  if (options.analyzeOnly) {
    lines.push('', 'Links were not validated (--analyze-only).');
  } else if (options.skipExternal) {
    lines.push('', 'External links were not checked (--skip-external).');
  }

  lines.push('');

  return lines.join('\n');
}

function appendInventory(analysis: ProjectAnalysis, lines: string[]): void {
  const referencesByDocument = groupReferences(analysis);

  for (const document of analysis.documents) {
    lines.push(document.relativePath);

    const references = referencesByDocument.get(document.relativePath) ?? [];
    if (references.length === 0) {
      lines.push('  (no references)');
    }

    for (const reference of references) {
      const position = `${reference.reference.position.line}:${reference.reference.position.column}`;
      lines.push(`  ${position.padEnd(8)} ${reference.kind.padEnd(22)} ${reference.reference.destination}`);
    }

    lines.push('');
  }
}

function appendIssues(issues: readonly Issue[], lines: string[]): void {
  if (issues.length === 0) {
    lines.push('No problems found.', '');
    return;
  }

  lines.push('Problems');

  let currentFile: string | null = null;

  for (const issue of issues) {
    if (issue.relativePath !== currentFile) {
      currentFile = issue.relativePath;
      lines.push(`  ${issue.relativePath}`);
    }

    const position = `${issue.position.line}:${issue.position.column}`;
    lines.push(
      `    ${position.padEnd(8)} ${issue.severity.padEnd(8)} ${issue.code.padEnd(20)} ${issue.message}`,
    );
  }

  lines.push('');
}

function groupReferences(analysis: ProjectAnalysis): Map<string, ClassifiedReference[]> {
  const grouped = new Map<string, ClassifiedReference[]>();

  for (const reference of analysis.references) {
    const relativePath = reference.document.relativePath;
    const bucket = grouped.get(relativePath);
    if (bucket === undefined) {
      grouped.set(relativePath, [reference]);
    } else {
      bucket.push(reference);
    }
  }

  return grouped;
}

function count(value: number, singular: string): string {
  return `${value} ${value === 1 ? singular : `${singular}s`}`;
}
